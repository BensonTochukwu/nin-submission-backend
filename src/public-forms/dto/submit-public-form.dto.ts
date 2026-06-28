import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AllowedState } from '../../common/utils/allowed-state.util';

export class SubmitPublicFormDto {
  @ApiProperty({ enum: AllowedState, example: AllowedState.LAGOS })
  @IsEnum(AllowedState)
  state: AllowedState;

  @ApiProperty({ example: 'LA/25A/1234' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[A-Za-z]{2,3}\/[0-9]{2}[A-Za-z]\/[0-9]{1,6}$/, {
    message: 'stateCode must look like LA/25A/1234',
  })
  stateCode: string;

  @ApiProperty({ example: 'Jane Corps Member' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false, example: 'Jane Corps Member', deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9]{11}$/, {
    message: 'ninNumber must be 11 digits',
  })
  ninNumber: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @ApiProperty({ required: false, example: '{"platoon":"1","lga":"Ikeja"}' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  fields?: string;

  @ApiProperty({ required: false, example: 'ninPdf' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/, {
    message: 'fileFieldKey must start with a letter and contain only letters, numbers, and underscores',
  })
  fileFieldKey?: string;
}
