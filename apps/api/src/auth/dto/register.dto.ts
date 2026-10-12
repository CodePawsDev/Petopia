import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(8, 64)
  @Matches(/\S/, {
    message: 'password must not contain only whitespace',
  })
  password!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  displayName!: string;
}
