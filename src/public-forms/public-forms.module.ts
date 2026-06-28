import { BadRequestException, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';
import { diskStorage } from 'multer';
import { PdfModule } from '../pdf/pdf.module';
import { MAX_ORIGINAL_UPLOAD_BYTES } from '../pdf/pdf.constants';
import { UploadsModule } from '../uploads/uploads.module';
import { PublicFormsController } from './public-forms.controller';
import { PublicFormsService } from './public-forms.service';

function resolveUploadDir(config: ConfigService) {
  const configuredPath = config.get<string>('UPLOAD_TMP_DIR', 'tmp/uploads');
  return isAbsolute(configuredPath) ? configuredPath : join(process.cwd(), configuredPath);
}

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            const uploadDir = resolveUploadDir(config);
            mkdirSync(uploadDir, { recursive: true });
            callback(null, uploadDir);
          },
          filename: (_request, file, callback) => {
            const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            callback(null, `${suffix}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
          },
        }),
        limits: {
          fileSize: MAX_ORIGINAL_UPLOAD_BYTES,
        },
        fileFilter: (_request, file, callback) => {
          const looksLikePdf =
            file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
          const lowerName = file.originalname.toLowerCase();
          const looksLikeImage =
            ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype) ||
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg') ||
            lowerName.endsWith('.png');
          if (looksLikePdf || looksLikeImage) {
            callback(null, true);
            return;
          }
          callback(new BadRequestException('Only PDF, JPG, JPEG, and PNG files are allowed'), false);
        },
      }),
    }),
    PdfModule,
    UploadsModule,
  ],
  controllers: [PublicFormsController],
  providers: [PublicFormsService],
})
export class PublicFormsModule {}
