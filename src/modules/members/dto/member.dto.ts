import { IsArray, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListMembersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class SetMemberBranchesDto {
  /** An empty list clears every restriction, giving access to all branches. */
  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];
}
