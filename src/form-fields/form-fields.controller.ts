import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { CreateFormFieldsDto } from './dto/create-form-fields.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';
import { FormFieldsService } from './form-fields.service';

@ApiTags('Form fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FormFieldsController {
  constructor(private readonly formFieldsService: FormFieldsService) {}

  @Post('forms/:formId/fields')
  create(
    @Param('formId') formId: string,
    @Body() dto: CreateFormFieldDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.formFieldsService.create(formId, dto, admin.id);
  }

  @Post('forms/:formId/fields/bulk')
  createMany(
    @Param('formId') formId: string,
    @Body() dto: CreateFormFieldsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.formFieldsService.createMany(formId, dto, admin.id);
  }

  @Get('forms/:formId/fields')
  findByForm(@Param('formId') formId: string) {
    return this.formFieldsService.findByForm(formId);
  }

  @Patch('fields/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFormFieldDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formFieldsService.update(id, dto, admin.id);
  }

  @Delete('fields/:id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.formFieldsService.remove(id, admin.id);
  }
}
