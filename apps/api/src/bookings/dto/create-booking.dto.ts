import { IsISO8601, IsUUID, Matches } from 'class-validator';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';

export class CreateBookingDto extends CreateQuoteDto {
  @IsUUID()
  groomerId!: string;

  @IsISO8601({ strict: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;

  @IsUUID('4')
  requestKey!: string;
}
