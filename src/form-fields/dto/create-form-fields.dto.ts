import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateFormFieldDto } from './create-form-field.dto';

export class CreateFormFieldsDto {
  @ApiProperty({ type: [CreateFormFieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFormFieldDto)
  fields: CreateFormFieldDto[];
}
