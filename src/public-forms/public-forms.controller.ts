import { Controller, Get, Param, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmitPublicFormDto } from './dto/submit-public-form.dto';
import { PublicFormsService } from './public-forms.service';

@ApiTags('Public')
@Controller('public/forms')
export class PublicFormsController {
  constructor(private readonly publicFormsService: PublicFormsService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.publicFormsService.getBySlug(slug);
  }

  @Post(':slug/submit')
  @Throttle({
    default: {
      limit: Number(process.env.PUBLIC_SUBMISSION_RATE_LIMIT ?? '10'),
      ttl: Number(process.env.PUBLIC_SUBMISSION_RATE_TTL ?? '60000'),
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['state', 'name', 'email', 'phone', 'stateCode', 'ninNumber', 'ninPdf'],
      properties: {
        state: { type: 'string', enum: ['LAGOS', 'ONDO'], example: 'LAGOS' },
        name: { type: 'string', example: 'Jane Corps Member' },
        email: { type: 'string', example: 'jane@example.com' },
        phone: { type: 'string', example: '+2348012345678' },
        stateCode: { type: 'string', example: 'LA/25A/1234' },
        ninNumber: { type: 'string', example: '12345678901' },
        fullName: { type: 'string', example: 'Jane Corps Member', deprecated: true },
        fields: { type: 'string', example: '{"platoon":"1"}' },
        fileFieldKey: { type: 'string', example: 'ninPdf' },
        ninPdf: {
          type: 'string',
          format: 'binary',
          description: 'NIN document upload. Accepts PDF, JPG, JPEG, or PNG. Images are converted to PDF.',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('ninPdf'))
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitPublicFormDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.publicFormsService.submit(slug, dto, file);
  }
}
