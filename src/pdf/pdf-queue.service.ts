import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PDF_QUEUE } from './pdf.constants';
import { PdfCompressionJob } from './pdf.types';

@Injectable()
export class PdfQueueService {
  constructor(@InjectQueue(PDF_QUEUE) private readonly queue: Queue<PdfCompressionJob>) {}

  async enqueueCompression(uploadedFileId: string) {
    return this.queue.add(
      'compress-pdf',
      { uploadedFileId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
