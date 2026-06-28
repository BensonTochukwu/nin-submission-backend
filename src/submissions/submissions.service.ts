import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

const submissionInclude = {
  form: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
  uploadedFiles: {
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.SubmissionInclude;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findByForm(formId: string) {
    await this.ensureFormExists(formId);
    const submissions = await this.prisma.submission.findMany({
      where: { formId },
      include: submissionInclude,
      orderBy: { submittedAt: 'desc' },
    });

    return Promise.all(submissions.map((submission) => this.withSignedFileUrls(submission)));
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: submissionInclude,
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return this.withSignedFileUrls(submission);
  }

  async updateStatus(id: string, status: SubmissionStatus, adminId: string) {
    try {
      const submission = await this.prisma.submission.update({
        where: { id },
        data: { status },
        include: submissionInclude,
      });

      await this.auditLogs.record({
        adminId,
        action: 'SUBMISSION_STATUS_UPDATED',
        entityType: 'Submission',
        entityId: id,
        metadata: { status },
      });

      return this.withSignedFileUrls(submission);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Submission not found');
      }
      throw error;
    }
  }

  async remove(id: string, adminId: string) {
    try {
      const submission = await this.prisma.submission.delete({
        where: { id },
      });

      await this.auditLogs.record({
        adminId,
        action: 'SUBMISSION_DELETED',
        entityType: 'Submission',
        entityId: id,
      });

      return submission;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Submission not found');
      }
      throw error;
    }
  }

  async create(formId: string, dto: any) {
    await this.ensureFormExists(formId);

    const submission = await this.prisma.submission.create({
      data: {
        formId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        stateCode: dto.stateCode,
        data: {
          state: dto.state,
          ninNumber: dto.ninNumber,
        },
      },
      include: submissionInclude,
    });

    await this.auditLogs.record({
      adminId: null,
      action: 'SUBMISSION_CREATED',
      entityType: 'Submission',
      entityId: submission.id,
    });

    return this.withSignedFileUrls(submission);
  }

  private async withSignedFileUrls<T extends { uploadedFiles: Array<{ storageKey: string | null; storedFilename: string }> }>(
    submission: T,
  ) {
    const uploadedFiles = await Promise.all(
      submission.uploadedFiles.map(async (file) => ({
        ...file,
        downloadUrl: await this.uploads.getSignedDownloadUrlForUpload(file.storageKey, file.storedFilename),
      })),
    );

    return {
      ...submission,
      uploadedFiles,
    };
  }

  private async ensureFormExists(formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      select: { id: true },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
