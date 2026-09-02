import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListUsersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
