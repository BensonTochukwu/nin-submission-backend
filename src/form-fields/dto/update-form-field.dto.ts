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
  ValidateIf,
} from 'class-validator';

export class UpdateFormFieldDto {
  @ApiProperty({ required: false, example: 'Name' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label?: string;

  @ApiProperty({ required: false, example: 'name' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/, {
    message: 'fieldKey must start with a letter and contain only letters, numbers, and underscores',
  })
  fieldKey?: string;

  @ApiProperty({ required: false, enum: FormFieldType, example: FormFieldType.TEXT })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FormFieldType)
  type?: FormFieldType;

  @ApiProperty({ default: false, required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ required: false, nullable: true, example: { choices: ['Option A', 'Option B'] } })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown> | null;

  @ApiProperty({ default: 0, required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
