import { Injectable, NotFoundException } from '@nestjs/common';
import { CompressionStatus } from '@prisma/client';
import archiver from 'archiver';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { stateCodeToSafePdfFilename } from '../common/utils/state-code.util';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

const EXPORTABLE_COMPRESSION_STATUSES: CompressionStatus[] = [CompressionStatus.DONE, CompressionStatus.NEEDS_REVIEW];
const BUILT_IN_RESPONSE_KEYS = new Set(['state', 'stateCode', 'name', 'fullName', 'email', 'phone', 'ninNumber', 'ninPdf']);

interface ExportColumn {
  header: string;
  key: string;
}

type ExportRow = Record<string, string>;

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createExcelExport(formId: string, adminId: string) {
    const form = await this.getFormWithSubmissions(formId);
    const columns = this.getResponseColumns(form);
    const rows = await this.getResponseRows(form, columns);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Submissions');

    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: this.getExcelColumnWidth(column.key),
    }));
    sheet.addRows(rows);

    sheet.getRow(1).font = { bold: true };

    await this.auditLogs.record({
      adminId,
      action: 'FORM_EXCEL_EXPORTED',
      entityType: 'Form',
      entityId: formId,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: `${form.slug}-submissions.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  async createCsvExport(formId: string, adminId: string) {
    const form = await this.getFormWithSubmissions(formId);
    const columns = this.getResponseColumns(form);
    const rows = await this.getResponseRows(form, columns);
    const csv = [
      columns.map((column) => this.escapeCsvValue(column.header)).join(','),
      ...rows.map((row) => columns.map((column) => this.escapeCsvValue(row[column.key] ?? '')).join(',')),
    ].join('\r\n');

    await this.auditLogs.record({
      adminId,
      action: 'FORM_CSV_EXPORTED',
      entityType: 'Form',
      entityId: formId,
    });

    return {
      filename: `${form.slug}-submissions.csv`,
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  async createNinZipExport(formId: string, adminId: string) {
    const form = await this.getFormWithSubmissions(formId);
    const output = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);

    void (async () => {
      for (const submission of form.submissions) {
        const files = submission.uploadedFiles.filter(
          (file) => file.storageKey && EXPORTABLE_COMPRESSION_STATUSES.includes(file.compressionStatus),
        );

        for (const file of files) {
          const objectStream = await this.uploads.getObjectStream(file.storageKey as string);
          archive.append(objectStream, {
            name: `${stateCodeToSafePdfFilename(submission.stateCode).replace(/\.pdf$/i, '')}/${file.storedFilename}`,
          });
        }
      }

      await archive.finalize();
    })().catch((error) => output.destroy(error));

    await this.auditLogs.record({
      adminId,
      action: 'FORM_ZIP_EXPORTED',
      entityType: 'Form',
      entityId: formId,
    });

    return {
      filename: `${form.slug}-nin-pdfs.zip`,
      stream: output,
    };
  }

  private getResponseColumns(form: Awaited<ReturnType<ExportsService['getFormWithSubmissions']>>): ExportColumn[] {
    const dynamicColumns = form.fields
      .filter((field) => !BUILT_IN_RESPONSE_KEYS.has(field.fieldKey))
      .map((field) => ({ header: field.label, key: `field_${field.fieldKey}` }));

    return [
      { header: 'Submission ID', key: 'id' },
      { header: 'State', key: 'state' },
      { header: 'State Code', key: 'stateCode' },
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'NIN Number', key: 'ninNumber' },
      { header: 'Status', key: 'status' },
      { header: 'Submitted At', key: 'submittedAt' },
      ...dynamicColumns,
      { header: 'Compression Status', key: 'compressionStatus' },
      { header: 'NIN PDF Download Link/Status', key: 'fileDownload' },
    ];
  }

  private async getResponseRows(
    form: Awaited<ReturnType<ExportsService['getFormWithSubmissions']>>,
    columns: ExportColumn[],
  ): Promise<ExportRow[]> {
    const dynamicColumns = columns.filter((column) => column.key.startsWith('field_'));
    const rows: ExportRow[] = [];

    for (const submission of form.submissions) {
      const file = submission.uploadedFiles[0];
      const signedUrl = file?.storageKey
        ? await this.uploads.getSignedDownloadUrlForUpload(file.storageKey, file.storedFilename, 3600)
        : null;
      const data = this.toRecord(submission.data);
      const row: ExportRow = {
        id: submission.id,
        state: this.stringifyExportValue(data.state),
        stateCode: submission.stateCode,
        name: submission.fullName ?? '',
        email: submission.email ?? '',
        phone: submission.phone ?? '',
        ninNumber: this.stringifyExportValue(data.ninNumber),
        status: submission.status,
        submittedAt: submission.submittedAt.toISOString(),
        compressionStatus: file?.compressionStatus ?? 'NO_FILE',
        fileDownload: signedUrl ?? file?.compressionStatus ?? 'NO_FILE',
      };

      for (const column of dynamicColumns) {
        row[column.key] = this.stringifyExportValue(data[column.key.replace(/^field_/, '')]);
      }

      rows.push(row);
    }

    return rows;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private stringifyExportValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private escapeCsvValue(value: string) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private getExcelColumnWidth(key: string) {
    if (key === 'id') {
      return 30;
    }
    if (key === 'fileDownload') {
      return 70;
    }
    if (key === 'submittedAt') {
      return 24;
    }
    return 20;
  }

  private async getFormWithSubmissions(formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: {
            uploadedFiles: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return form;
  }
}
