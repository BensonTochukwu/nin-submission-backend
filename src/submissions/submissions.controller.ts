import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';

import { UpdateSubmissionStatusDto } from './dto/update-submission-status.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@Controller()
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
  ) {}

  // ADMIN ONLY
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('forms/:formId/submissions')
  findByForm(@Param('formId') formId: string) {
    return this.submissionsService.findByForm(formId);
  }

  // ADMIN ONLY
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('submissions/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  // ADMIN ONLY
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('submissions/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.submissionsService.updateStatus(
      id,
      dto.status,
      admin.id,
    );
  }

  // ADMIN ONLY
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('submissions/:id')
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.submissionsService.remove(id, admin.id);
  }
}