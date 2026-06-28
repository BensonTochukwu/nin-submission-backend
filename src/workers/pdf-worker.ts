import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PdfWorkerModule } from './pdf-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(PdfWorkerModule);
}

void bootstrap();
