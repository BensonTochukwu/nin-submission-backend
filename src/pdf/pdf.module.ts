import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PDF_QUEUE } from './pdf.constants';
import { PdfQueueService } from './pdf-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PDF_QUEUE,
    }),
  ],
  providers: [PdfQueueService],
  exports: [PdfQueueService, BullModule],
})
export class PdfModule {}
