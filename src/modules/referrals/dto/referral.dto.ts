import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AttributeReferralDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}

export class ReferralLeaderboardQueryDto extends PaginationQueryDto {}
