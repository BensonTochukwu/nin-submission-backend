import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/authenticated-admin';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  create(@Body() dto: CreateAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminsService.create(dto, admin.id);
  }

  @Get()
  findAll() {
    return this.adminsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminsService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminsService.remove(id, admin.id);
  }
}
