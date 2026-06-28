import { Controller, Get, Param, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';
import { ExportsService } from './exports.service';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms/:formId/export')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('excel')
  async excel(
    @Param('formId') formId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exportFile = await this.exportsService.createExcelExport(formId, admin.id);
    response.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${exportFile.filename}"`,
    });
    return exportFile.buffer;
  }

  @Get('csv')
  async csv(
    @Param('formId') formId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exportFile = await this.exportsService.createCsvExport(formId, admin.id);
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFile.filename}"`,
    });
    return exportFile.buffer;
  }

  @Get('nins.zip')
  async ninZip(
    @Param('formId') formId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamNinZip(formId, admin.id, response);
  }

  @Get('files.zip')
  async zip(
    @Param('formId') formId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamNinZip(formId, admin.id, response);
  }

  private async streamNinZip(formId: string, adminId: string, response: Response) {
    const exportFile = await this.exportsService.createNinZipExport(formId, adminId);
    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${exportFile.filename}"`,
    });
    return new StreamableFile(exportFile.stream);
  }
}
