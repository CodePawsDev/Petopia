import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PetSpecies } from '../../generated/prisma/client';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePetDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEnum(PetSpecies)
  species!: PetSpecies;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(100)
  breed?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must use YYYY-MM-DD format',
  })
  @IsDateString({ strict: true })
  birthDate?: string | null;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 3,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0.001)
  @Max(999.999)
  weightKg?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  careNotes?: string | null;
}
