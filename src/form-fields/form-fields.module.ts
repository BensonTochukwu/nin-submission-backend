import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { FormFieldsController } from './form-fields.controller';
import { FormFieldsService } from './form-fields.service';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [FormFieldsController],
  providers: [FormFieldsService],
  exports: [FormFieldsService],
})
export class FormFieldsModule {}
