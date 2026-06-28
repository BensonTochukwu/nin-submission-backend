import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminSelect;

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateAdminDto, actorId: string) {
    try {
      const admin = await this.prisma.admin.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: dto.role ?? AdminRole.ADMIN,
          isActive: dto.isActive ?? true,
        },
        select: adminSelect,
      });

      await this.auditLogs.record({
        adminId: actorId,
        action: 'ADMIN_CREATED',
        entityType: 'Admin',
        entityId: admin.id,
      });

      return admin;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: adminSelect,
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: adminSelect,
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async update(id: string, dto: UpdateAdminDto, actorId: string) {
    const data: Prisma.AdminUpdateInput = {
      name: dto.name,
      email: dto.email?.toLowerCase(),
      role: dto.role,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    try {
      const admin = await this.prisma.admin.update({
        where: { id },
        data,
        select: adminSelect,
      });

      await this.auditLogs.record({
        adminId: actorId,
        action: 'ADMIN_UPDATED',
        entityType: 'Admin',
        entityId: id,
      });

      return admin;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Admin not found');
      }
      if (this.isUniqueError(error)) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new ForbiddenException('You cannot deactivate your own admin account');
    }

    try {
      const admin = await this.prisma.admin.update({
        where: { id },
        data: { isActive: false },
        select: adminSelect,
      });

      await this.auditLogs.record({
        adminId: actorId,
        action: 'ADMIN_DEACTIVATED',
        entityType: 'Admin',
        entityId: id,
      });

      return admin;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Admin not found');
      }
      throw error;
    }
  }

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
