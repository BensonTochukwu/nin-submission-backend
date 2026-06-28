import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { getEnabledStates } from '../common/utils/allowed-state.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateFormDto, adminId: string) {
    this.ensureCreateHasAtLeastOneStateEnabled(dto);

    try {
      const form = await this.prisma.form.create({
        data: {
          title: dto.title,
          description: dto.description,
          slug: this.toSlug(dto.slug ?? dto.title),
          isActive: dto.isActive ?? true,
          allowDuplicateStateCode: dto.allowDuplicateStateCode ?? false,
          lagosEnabled: dto.lagosEnabled ?? true,
          ondoEnabled: dto.ondoEnabled ?? true,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
          createdById: adminId,
        },
      });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_CREATED',
        entityType: 'Form',
        entityId: form.id,
      });

      return form;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Form slug already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.form.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { fields: true, submissions: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findUnique({
      where: { id },
      include: {
        fields: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return form;
  }

  async update(id: string, dto: UpdateFormDto, adminId: string) {
    const data: Prisma.FormUpdateInput = {
      title: dto.title,
      description: dto.description,
      slug: dto.slug ? this.toSlug(dto.slug) : undefined,
      isActive: dto.isActive,
      allowDuplicateStateCode: dto.allowDuplicateStateCode,
      lagosEnabled: dto.lagosEnabled,
      ondoEnabled: dto.ondoEnabled,
    };

    await this.ensureAtLeastOneStateEnabled(id, dto);

    if (Object.prototype.hasOwnProperty.call(dto, 'closesAt')) {
      data.closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    }

    try {
      const form = await this.prisma.form.update({
        where: { id },
        data,
      });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_UPDATED',
        entityType: 'Form',
        entityId: id,
      });

      return form;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Form not found');
      }
      if (this.isUniqueError(error)) {
        throw new ConflictException('Form slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string, adminId: string) {
    try {
      const form = await this.prisma.form.delete({ where: { id } });

      await this.auditLogs.record({
        adminId,
        action: 'FORM_DELETED',
        entityType: 'Form',
        entityId: id,
      });

      return form;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Form not found');
      }
      throw error;
    }
  }

  async open(id: string, adminId: string) {
    const form = await this.setActive(id, true);
    await this.auditLogs.record({
      adminId,
      action: 'FORM_OPENED',
      entityType: 'Form',
      entityId: id,
    });
    return form;
  }

  async close(id: string, adminId: string) {
    const form = await this.setActive(id, false);
    await this.auditLogs.record({
      adminId,
      action: 'FORM_CLOSED',
      entityType: 'Form',
      entityId: id,
    });
    return form;
  }

  getPublicUrl(slug: string) {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
    return `${appUrl}/public/forms/${slug}`;
  }

  private async setActive(id: string, isActive: boolean) {
    try {
      return await this.prisma.form.update({
        where: { id },
        data: { isActive },
      });
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Form not found');
      }
      throw error;
    }
  }

  private async ensureAtLeastOneStateEnabled(id: string, dto: UpdateFormDto) {
    if (dto.lagosEnabled === undefined && dto.ondoEnabled === undefined) {
      return;
    }

    const form = await this.prisma.form.findUnique({
      where: { id },
      select: { lagosEnabled: true, ondoEnabled: true },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const nextStateSettings = {
      lagosEnabled: dto.lagosEnabled ?? form.lagosEnabled,
      ondoEnabled: dto.ondoEnabled ?? form.ondoEnabled,
    };

    if (!getEnabledStates(nextStateSettings).length) {
      throw new BadRequestException('At least one state must remain enabled');
    }
  }

  private ensureCreateHasAtLeastOneStateEnabled(dto: CreateFormDto) {
    if (
      !getEnabledStates({
        lagosEnabled: dto.lagosEnabled ?? true,
        ondoEnabled: dto.ondoEnabled ?? true,
      }).length
    ) {
      throw new BadRequestException('At least one state must be enabled');
    }
  }

  private toSlug(value: string) {
    const slug = slugify(value, { lower: true, strict: true, trim: true });
    if (!slug) {
      throw new BadRequestException('Form slug cannot be empty');
    }
    return slug;
  }

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
