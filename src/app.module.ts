import 'dotenv/config';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminsModule } from './admins/admins.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { ExportsModule } from './exports/exports.module';
import { FormFieldsModule } from './form-fields/form-fields.module';
import { FormsModule } from './forms/forms.module';
import { PdfModule } from './pdf/pdf.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicFormsModule } from './public-forms/public-forms.module';
import { QrModule } from './qr/qr.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UploadsModule } from './uploads/uploads.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<string>('THROTTLE_TTL', '60000')),
          limit: Number(config.get<string>('THROTTLE_LIMIT', '100')),
        },
      ],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
        },
      }),
    }),
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    AdminsModule,
    FormsModule,
    FormFieldsModule,
    PublicFormsModule,
    SubmissionsModule,
    UploadsModule,
    PdfModule,
    ExportsModule,
    QrModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
