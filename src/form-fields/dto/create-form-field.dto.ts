import { ApiProperty } from '@nestjs/swagger';
import { FormFieldType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFormFieldDto {
  @ApiProperty({ example: 'Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label: string;

  @ApiProperty({ example: 'name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/, {
    message: 'fieldKey must start with a letter and contain only letters, numbers, and underscores',
  })
  fieldKey: string;

  @ApiProperty({ enum: FormFieldType, example: FormFieldType.TEXT })
  @IsEnum(FormFieldType)
  type: FormFieldType;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ required: false, nullable: true, example: { choices: ['Option A', 'Option B'] } })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown> | null;

  @ApiProperty({ default: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
