import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { CreateFormFieldsDto } from './dto/create-form-fields.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';

@Injectable()
export class FormFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(formId: string, dto: CreateFormFieldDto, adminId: string) {
    await this.ensureFormExists(formId);

    try {
      const field = await this.prisma.formField.create({
        data: {
          formId,
          label: dto.label,
          fieldKey: dto.fieldKey,
          type: dto.type,
          isRequired: dto.isRequired ?? false,
          options: this.toNullableJsonInput(dto.options),
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_FIELD_CREATED',
        entityType: 'FormField',
        entityId: field.id,
        metadata: { formId },
      });

      return field;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Field key already exists for this form');
      }
      throw error;
    }
  }

  async createMany(formId: string, dto: CreateFormFieldsDto, adminId: string) {
    await this.ensureFormExists(formId);

    try {
      const fields = await this.prisma.$transaction(
        dto.fields.map((field) =>
          this.prisma.formField.create({
            data: {
              formId,
              label: field.label,
              fieldKey: field.fieldKey,
              type: field.type,
              isRequired: field.isRequired ?? false,
              options: this.toNullableJsonInput(field.options),
              sortOrder: field.sortOrder ?? 0,
            },
          }),
        ),
      );

      await this.auditLogs.record({
        adminId,
        action: 'FORM_FIELDS_CREATED',
        entityType: 'Form',
        entityId: formId,
        metadata: { formId, fieldIds: fields.map((field) => field.id) },
      });

      return fields;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('One or more field keys already exist for this form');
      }
      throw error;
    }
  }

  async findByForm(formId: string) {
    await this.ensureFormExists(formId);
    return this.prisma.formField.findMany({
      where: { formId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateFormFieldDto, adminId: string) {
    try {
      const field = await this.prisma.formField.update({
        where: { id },
        data: {
          label: dto.label,
          fieldKey: dto.fieldKey,
          type: dto.type,
          isRequired: dto.isRequired,
          options: this.toNullableJsonInput(dto.options),
          sortOrder: dto.sortOrder,
        },
      });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_FIELD_UPDATED',
        entityType: 'FormField',
        entityId: id,
        metadata: { formId: field.formId },
      });

      return field;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Form field not found');
      }
      if (this.isUniqueError(error)) {
        throw new ConflictException('Field key already exists for this form');
      }
      throw error;
    }
  }

  async remove(id: string, adminId: string) {
    try {
      const field = await this.prisma.formField.delete({ where: { id } });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_FIELD_DELETED',
        entityType: 'FormField',
        entityId: id,
        metadata: { formId: field.formId },
      });

      return field;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Form field not found');
      }
      throw error;
    }
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

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }

  private toNullableJsonInput(value: Record<string, unknown> | null | undefined) {
    if (value === undefined) {
      return undefined;
    }
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonObject);
  }
}
