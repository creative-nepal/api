import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateBranchDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'code must be uppercase letters and digits',
  })
  code!: string;

  @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListBranchesQueryDto extends ListQueryDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
