import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { CompressionStatus, FormFieldType, Prisma } from '@prisma/client';
import { AllowedState, getEnabledStateOptions, getEnabledStates } from '../common/utils/allowed-state.util';
import { parseJsonObject } from '../common/utils/json.util';
import { normalizeStateCode } from '../common/utils/state-code.util';
import { PdfQueueService } from '../pdf/pdf-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { SubmitPublicFormDto } from './dto/submit-public-form.dto';

@Injectable()
export class PublicFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly pdfQueue: PdfQueueService,
  ) {}

  async getBySlug(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: {
        fields: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!form || !form.isActive) {
      throw new NotFoundException('Form not found');
    }

    if (form.closesAt && form.closesAt.getTime() <= Date.now()) {
      throw new BadRequestException('Form is closed');
    }

    return {
      id: form.id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      closesAt: form.closesAt,
      enabledStates: getEnabledStateOptions(form),
      fields: form.fields.map((field) => ({
        id: field.id,
        label: field.label,
        fieldKey: field.fieldKey,
        type: field.type,
        isRequired: field.isRequired,
        options: field.options,
        sortOrder: field.sortOrder,
      })),
    };
  }

  async submit(slug: string, dto: SubmitPublicFormDto, file?: Express.Multer.File) {
    let uploadedFileId: string | undefined;
    let preparedFile: Express.Multer.File | undefined;

    try {
      preparedFile = await this.uploads.prepareNinUpload(file);

      const form = await this.prisma.form.findUnique({
        where: { slug },
        include: {
          fields: true,
        },
      });

      if (!form || !form.isActive) {
        throw new NotFoundException('Form not found or not active');
      }

      if (form.closesAt && form.closesAt.getTime() <= Date.now()) {
        throw new BadRequestException('Form is closed');
      }

      this.validateSelectedState(form, dto.state);

      const stateCode = normalizeStateCode(dto.stateCode);
      const fieldData = {
        ...(parseJsonObject(dto.fields, 'fields') ?? {}),
        state: dto.state,
        ninNumber: dto.ninNumber,
      };
      const fullName = dto.name ?? dto.fullName;
      const ninUpload = preparedFile;
      if (!ninUpload) {
        throw new BadRequestException('NIN upload is required');
      }
      this.validateRequiredFields(form.fields, fieldData, dto, ninUpload);

      const result = await this.prisma.$transaction(async (tx) => {
        if (!form.allowDuplicateStateCode) {
          const existingSubmission = await tx.submission.findFirst({
            where: {
              formId: form.id,
              stateCode,
            },
            select: { id: true },
          });

          if (existingSubmission) {
            throw new ConflictException('State code has already submitted this form');
          }
        }

        const submission = await tx.submission.create({
          data: {
            formId: form.id,
            stateCode,
            fullName,
            email: dto.email,
            phone: dto.phone,
            data: fieldData as Prisma.InputJsonObject,
          },
        });

        const uploadedFile = await tx.uploadedFile.create({
          data: this.uploads.createUploadData(submission.id, stateCode, ninUpload, dto.fileFieldKey ?? 'ninPdf'),
        });

        return { submission, uploadedFile };
      });

      uploadedFileId = result.uploadedFile.id;
      await this.pdfQueue.enqueueCompression(result.uploadedFile.id);

        return {
          success: true,
          message: 'Submission created and NIN document compression queued',
          submissionId: result.submission.id,
          uploadedFileId: result.uploadedFile.id,
        };
    } catch (error) {
      if (uploadedFileId) {
        await this.prisma.uploadedFile
          .update({
            where: { id: uploadedFileId },
            data: {
              compressionStatus: CompressionStatus.FAILED,
              tempPath: null,
            },
          })
          .catch(() => undefined);
      }
      await this.safeUnlink(preparedFile?.path ?? file?.path);
      throw error;
    }
  }

  private validateRequiredFields(
    fields: Array<{ fieldKey: string; isRequired: boolean; type: FormFieldType }>,
    fieldData: Record<string, unknown>,
    dto: SubmitPublicFormDto,
    file?: Express.Multer.File,
  ) {
    const builtInValues: Record<string, unknown> = {
      stateCode: dto.stateCode,
      state: dto.state,
      name: dto.name,
      fullName: dto.name ?? dto.fullName,
      email: dto.email,
      phone: dto.phone,
      ninNumber: dto.ninNumber,
      ninPdf: file,
    };

    for (const field of fields) {
      if (!field.isRequired) {
        continue;
      }

      if (field.type === FormFieldType.FILE) {
        if (!file) {
          throw new BadRequestException(`${field.fieldKey} is required`);
        }
        continue;
      }

      const value = builtInValues[field.fieldKey] ?? fieldData[field.fieldKey];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`${field.fieldKey} is required`);
      }
    }
  }

  private validateSelectedState(form: { lagosEnabled: boolean; ondoEnabled: boolean }, state: AllowedState) {
    if (!getEnabledStates(form).includes(state)) {
      throw new BadRequestException(`${state} is not available for this form`);
    }
  }

  private async safeUnlink(path?: string | null) {
    if (!path) {
      return;
    }
    try {
      await unlink(path);
    } catch {
      undefined;
    }
  }
}
