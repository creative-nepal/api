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
import { MAX_VIDEO_BYTES } from '../file-rules';
import {
  FILE_PURPOSES,
  FILE_VISIBILITIES,
  type FilePurpose,
  type FileVisibility,
} from '../../../database/schema';

export { MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES } from '../file-rules';

export class CreateUploadDto {
  @IsIn(FILE_PURPOSES) purpose!: FilePurpose;

  @IsString() @IsNotEmpty() @MaxLength(255) originalName!: string;

  @IsString() @IsNotEmpty() @MaxLength(128) contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  sizeBytes!: number;

  /** Defaults per purpose; only set this to override that choice. */
  @IsOptional() @IsIn(FILE_VISIBILITIES) visibility?: FileVisibility;
}

export class ListFilesQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(FILE_PURPOSES) purpose?: FilePurpose;
  @IsOptional() @IsIn(FILE_VISIBILITIES) visibility?: FileVisibility;
}
