import { IsISO8601, IsUUID, Matches, ValidateIf } from 'class-validator';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';

export class SearchAvailabilityDto extends CreateQuoteDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must use YYYY-MM-DD format',
  })
  @IsISO8601({ strict: true })
  date!: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID()
  groomerId?: string;
}
