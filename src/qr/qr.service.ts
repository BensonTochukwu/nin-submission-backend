import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  generatePng(value: string): Promise<Buffer> {
    return QRCode.toBuffer(value, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    });
  }
}
