import { Controller, Body, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';
import { QrService } from '../qr/qr.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsService } from './forms.service';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly qrService: QrService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Post()
  create(@Body() dto: CreateFormDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formsService.create(dto, admin.id);
  }

  @Get()
  findAll() {
    return this.formsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formsService.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formsService.remove(id, admin.id);
  }

  @Patch(':id/open')
  open(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formsService.open(id, admin.id);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formsService.close(id, admin.id);
  }

  @Get(':id/qr-code')
  async getQrCode(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    const form = await this.formsService.findOne(id);
    const buffer = await this.qrService.generatePng(this.formsService.getPublicUrl(form.slug));

    await this.auditLogs.record({
      adminId: admin.id,
      action: 'FORM_QR_GENERATED',
      entityType: 'Form',
      entityId: id,
    });

    response.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${form.slug}-qr.png"`,
    });
    return buffer;
  }
}
