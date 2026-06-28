import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';
import { UpdateSubmissionStatusDto } from './dto/update-submission-status.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get('forms/:formId/submissions')
  findByForm(@Param('formId') formId: string) {
    return this.submissionsService.findByForm(formId);
  }

  @Get('submissions/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Patch('submissions/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.submissionsService.updateStatus(id, dto.status, admin.id);
  }

  @Delete('submissions/:id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.submissionsService.remove(id, admin.id);
  }
}
