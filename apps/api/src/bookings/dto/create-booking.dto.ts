import { IsISO8601, IsUUID, Matches, ValidateIf } from 'class-validator';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';

export class CreateBookingDto extends CreateQuoteDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  groomerId?: string;

  @IsISO8601({ strict: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;

  @IsUUID('4')
  requestKey!: string;

  @Matches(/^[0-9a-f]{64}$/)
  expectedQuoteHash!: string;
}
