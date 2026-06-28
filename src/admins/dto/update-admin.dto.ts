import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateAdminDto {
  @ApiProperty({ required: false, example: 'Operations Admin' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false, example: 'ops@nysc.local' })
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ required: false, example: 'Password123!' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiProperty({ required: false, enum: AdminRole, default: AdminRole.ADMIN })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiProperty({ default: true, required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
