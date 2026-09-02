import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import { FILE_PURPOSES, type FilePurpose } from '../../../database/schema';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class CreateUploadDto {
  @IsIn(FILE_PURPOSES) purpose!: FilePurpose;

  @IsString() @IsNotEmpty() @MaxLength(255) originalName!: string;

  @IsString() @IsNotEmpty() @MaxLength(128) contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;
}

export class ListFilesQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(FILE_PURPOSES) purpose?: FilePurpose;
}
