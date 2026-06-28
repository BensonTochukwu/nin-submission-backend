import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateFormDto {
  @ApiProperty({ example: 'NYSC NIN Upload Form' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false, example: 'Collect NYSC member contact details and NIN upload.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ required: false, example: 'nysc-nin-upload' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  allowDuplicateStateCode?: boolean;

  @ApiProperty({ default: true, required: false, description: 'Allow applicants to select Lagos on this form.' })
  @IsOptional()
  @IsBoolean()
  lagosEnabled?: boolean;

  @ApiProperty({ default: true, required: false, description: 'Allow applicants to select Ondo on this form.' })
  @IsOptional()
  @IsBoolean()
  ondoEnabled?: boolean;

  @ApiProperty({ required: false, nullable: true, example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  closesAt?: string;
}
