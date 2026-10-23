import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkingIntervalDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsInt()
  @Min(540)
  @Max(1079)
  startMinute!: number;

  @IsInt()
  @Min(541)
  @Max(1080)
  endMinute!: number;
}

export class ReplaceWeeklyScheduleDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WorkingIntervalDto)
  intervals!: WorkingIntervalDto[];
}
