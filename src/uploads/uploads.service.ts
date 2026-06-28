import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CompressionStatus } from '@prisma/client';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { Readable } from 'stream';
import { stateCodeToSafePdfFilename } from '../common/utils/state-code.util';
import { TARGET_PDF_SIZE_BYTES, MAX_ORIGINAL_UPLOAD_BYTES } from '../pdf/pdf.constants';
import { PrismaService } from '../prisma/prisma.service';

interface CompressedPdfResult {
  path: string;
  size: number;
  cleanupPaths: string[];
}

const PDF_CONTENT_TYPE = 'application/pdf';
const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3Client?: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async prepareNinUpload(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('NIN upload is required');
    }

    if (file.size > MAX_ORIGINAL_UPLOAD_BYTES) {
      throw new BadRequestException('Maximum original upload size is 20MB');
    }

    if (this.isPdfUpload(file)) {
      await this.validatePdfAtPath(file.path);
      file.mimetype = PDF_CONTENT_TYPE;
      return file;
    }

    if (this.isImageUpload(file)) {
      const convertedPath = await this.convertImageToPdf(file);
      await this.safeUnlink(file.path);
      const compressed = await this.compressConvertedImagePdf(convertedPath);
      file.path = compressed.path;
      file.filename = basename(compressed.path);
      file.mimetype = PDF_CONTENT_TYPE;
      return file;
    }

    throw new BadRequestException('Only PDF, JPG, JPEG, and PNG files are allowed');
  }

  async validatePdfAtPath(path: string) {
    const buffer = await fs.readFile(path);
    const header = buffer.subarray(0, 5).toString('utf8');

    if (header !== '%PDF-') {
      throw new BadRequestException('Uploaded file is not a valid PDF');
    }

    try {
      await PDFDocument.load(buffer, { updateMetadata: false });
    } catch {
      throw new BadRequestException('PDF is corrupted or password protected');
    }
  }

  createUploadData(submissionId: string, stateCode: string, file: Express.Multer.File, fieldKey = 'ninPdf') {
    return {
      submissionId,
      fieldKey,
      originalFilename: file.originalname,
      storedFilename: stateCodeToSafePdfFilename(stateCode),
      tempPath: file.path,
      mimeType: PDF_CONTENT_TYPE,
      originalSize: file.size,
      compressionStatus: CompressionStatus.PENDING,
    };
  }

  async processUploadedPdf(uploadedFileId: string) {
    const upload = await this.prisma.uploadedFile.findUnique({
      where: { id: uploadedFileId },
      include: {
        submission: {
          include: {
            form: true,
          },
        },
      },
    });

    if (!upload) {
      throw new NotFoundException('Uploaded file not found');
    }

    if (!upload.tempPath) {
      throw new BadRequestException('Uploaded file has no temporary path');
    }

    let compressed: CompressedPdfResult | undefined;
    let shouldCleanupTempFiles = false;

    try {
      await this.prisma.uploadedFile.update({
        where: { id: upload.id },
        data: { compressionStatus: CompressionStatus.PROCESSING },
      });

      await this.validatePdfAtPath(upload.tempPath);
      compressed = await this.compressPdf(upload.tempPath, upload.storedFilename);

      const storageKey = [
        'forms',
        upload.submission.formId,
        'submissions',
        upload.submissionId,
        upload.storedFilename,
      ].join('/');

      await this.uploadPrivateObject(storageKey, compressed.path, 'application/pdf');

      const finalStatus =
        compressed.size <= TARGET_PDF_SIZE_BYTES ? CompressionStatus.DONE : CompressionStatus.NEEDS_REVIEW;

      await this.prisma.uploadedFile.update({
        where: { id: upload.id },
        data: {
          storageKey,
          fileUrl: null,
          compressedSize: compressed.size,
          tempPath: null,
          compressionStatus: finalStatus,
        },
      });

      shouldCleanupTempFiles = true;
      return { uploadedFileId: upload.id, compressionStatus: finalStatus };
    } catch (error) {
      this.logger.error(`PDF compression failed for upload ${upload.id}`, error instanceof Error ? error.stack : error);
      await this.prisma.uploadedFile.update({
        where: { id: upload.id },
        data: {
          compressionStatus: CompressionStatus.FAILED,
        },
      });
      throw error;
    } finally {
      if (shouldCleanupTempFiles) {
        await this.safeUnlink(upload.tempPath);
        if (compressed) {
          for (const cleanupPath of compressed.cleanupPaths) {
            await this.safeUnlink(cleanupPath);
          }
          if (compressed.path !== upload.tempPath) {
            await this.safeUnlink(compressed.path);
          }
        }
      }
    }
  }

  async getSignedDownloadUrl(uploadedFileId: string, expiresInSeconds = 300) {
    const upload = await this.prisma.uploadedFile.findUnique({ where: { id: uploadedFileId } });
    if (!upload) {
      throw new NotFoundException('Uploaded file not found');
    }
    return this.getSignedDownloadUrlForUpload(upload.storageKey, upload.storedFilename, expiresInSeconds);
  }

  async getSignedDownloadUrlForUpload(storageKey: string | null, filename: string, expiresInSeconds?: number) {
    if (!storageKey) {
      return null;
    }

    const expiresIn = expiresInSeconds ?? Number(this.config.get<string>('SIGNED_URL_EXPIRES_IN', '300'));
    const command = new GetObjectCommand({
      Bucket: this.getBucket(),
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    return getSignedUrl(this.getS3Client(), command, { expiresIn });
  }

  async getObjectStream(storageKey: string): Promise<Readable> {
    const response = await this.getS3Client().send(
      new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: storageKey,
      }),
    );

    if (!response.Body) {
      throw new InternalServerErrorException('Storage object has no body');
    }

    return response.Body as Readable;
  }

  private async compressPdf(inputPath: string, storedFilename: string): Promise<CompressedPdfResult> {
    const originalStat = await fs.stat(inputPath);
    if (originalStat.size <= TARGET_PDF_SIZE_BYTES) {
      return { path: inputPath, size: originalStat.size, cleanupPaths: [] };
    }

    const outputDir = join(process.cwd(), 'tmp', 'compressed');
    await fs.mkdir(outputDir, { recursive: true });

    const presets = ['screen', 'ebook', 'printer'];
    const candidates: Array<{ path: string; size: number }> = [];

    for (const preset of presets) {
      const outputPath = join(outputDir, `${Date.now()}-${preset}-${storedFilename}`);
      try {
        await this.runGhostscript(inputPath, outputPath, preset);
        const stat = await fs.stat(outputPath);
        candidates.push({ path: outputPath, size: stat.size });
      } catch (error) {
        this.logger.warn(
          `Ghostscript preset ${preset} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.safeUnlink(outputPath);
      }
    }

    if (!candidates.length) {
      throw new InternalServerErrorException('PDF compression failed');
    }

    const smallest = candidates.sort((a, b) => a.size - b.size)[0];
    return {
      path: smallest.path,
      size: smallest.size,
      cleanupPaths: candidates.filter((candidate) => candidate.path !== smallest.path).map((candidate) => candidate.path),
    };
  }

  private isPdfUpload(file: Express.Multer.File) {
    return file.mimetype === PDF_CONTENT_TYPE || extname(file.originalname).toLowerCase() === '.pdf';
  }

  private isImageUpload(file: Express.Multer.File) {
    return IMAGE_CONTENT_TYPES.has(file.mimetype) || IMAGE_EXTENSIONS.has(extname(file.originalname).toLowerCase());
  }

  private async convertImageToPdf(file: Express.Multer.File) {
    const imageBuffer = await fs.readFile(file.path);
    const extension = extname(file.originalname).toLowerCase();
    const imageType = this.getImageType(imageBuffer, extension);
    const pdf = await PDFDocument.create();
    const image = imageType === 'png' ? await pdf.embedPng(imageBuffer) : await pdf.embedJpg(imageBuffer);
    const page = pdf.addPage([595.28, 841.89]);
    const maxWidth = page.getWidth() - 56;
    const maxHeight = page.getHeight() - 56;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });

    const outputDir = join(process.cwd(), 'tmp', 'converted');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`);
    await fs.writeFile(outputPath, await pdf.save({ useObjectStreams: true }));
    await this.validatePdfAtPath(outputPath);
    return outputPath;
  }

  private async compressConvertedImagePdf(convertedPath: string) {
    let compressed: CompressedPdfResult | undefined;

    try {
      compressed = await this.compressPdf(convertedPath, basename(convertedPath));
      if (compressed.size > TARGET_PDF_SIZE_BYTES) {
        throw new BadRequestException('Image could not be converted to a PDF under 200KB');
      }

      for (const cleanupPath of compressed.cleanupPaths) {
        await this.safeUnlink(cleanupPath);
      }

      return { ...compressed, cleanupPaths: [] };
    } catch (error) {
      if (compressed) {
        for (const cleanupPath of compressed.cleanupPaths) {
          await this.safeUnlink(cleanupPath);
        }
        await this.safeUnlink(compressed.path);
      }
      throw error;
    } finally {
      if (!compressed || compressed.path !== convertedPath) {
        await this.safeUnlink(convertedPath);
      }
    }
  }

  private getImageType(buffer: Buffer, extension: string): 'jpg' | 'png' {
    const isJpg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (isJpg) {
      return 'jpg';
    }

    const isPng =
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (isPng) {
      return 'png';
    }

    if (extension === '.jpg' || extension === '.jpeg' || extension === '.png') {
      throw new BadRequestException('Uploaded image is not a valid JPG, JPEG, or PNG file');
    }

    throw new BadRequestException('Only JPG, JPEG, and PNG images are supported');
  }

  private async runGhostscript(inputPath: string, outputPath: string, preset: string) {
    const commands = process.platform === 'win32' ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];
    let lastError: unknown;

    for (const command of commands) {
      try {
        await this.spawnGhostscript(command, inputPath, outputPath, preset);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error && 'code' in lastError && lastError.code === 'ENOENT') {
      throw new ServiceUnavailableException(
        'Ghostscript is not installed or is not available in PATH. Install Ghostscript and restart the backend.',
      );
    }

    throw lastError;
  }

  private spawnGhostscript(command: string, inputPath: string, outputPath: string, preset: string) {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=/${preset}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dDownsampleColorImages=true',
      '-dColorImageResolution=96',
      '-dDownsampleGrayImages=true',
      '-dGrayImageResolution=96',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args);
      let stderr = '';

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `Ghostscript exited with code ${code}`));
      });
    });
  }

  private async uploadPrivateObject(storageKey: string, path: string, contentType: string) {
    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: storageKey,
        Body: createReadStream(path),
        ContentType: contentType,
        ACL: undefined,
      }),
    );
  }

  private getS3Client() {
    if (this.s3Client) {
      return this.s3Client;
    }

    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException('S3 credentials are not configured');
    }

    this.s3Client = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.s3Client;
  }

  private getBucket() {
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) {
      throw new InternalServerErrorException('S3 bucket is not configured');
    }
    return bucket;
  }

  private async safeUnlink(path?: string | null) {
    if (!path) {
      return;
    }
    try {
      await fs.unlink(path);
    } catch {
      undefined;
    }
  }
}
