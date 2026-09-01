import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
