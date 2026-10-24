import { IsDateString, Matches } from 'class-validator';
import { ListBookingsDto } from './list-bookings.dto';

export class ListBranchBookingsDto extends ListBookingsDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
}
