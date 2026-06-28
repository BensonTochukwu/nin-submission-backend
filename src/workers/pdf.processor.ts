import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PDF_QUEUE } from '../pdf/pdf.constants';
import { PdfCompressionJob } from '../pdf/pdf.types';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
  constructor(private readonly uploadsService: UploadsService) {
    super();
  }

  process(job: Job<PdfCompressionJob>) {
    return this.uploadsService.processUploadedPdf(job.data.uploadedFileId);
  }
}
