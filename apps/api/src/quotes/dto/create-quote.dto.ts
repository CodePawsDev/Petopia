import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateQuoteDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  petId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  serviceIds!: string[];
}
