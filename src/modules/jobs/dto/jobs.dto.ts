import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EMAIL_STATUSES, type EmailStatus } from '../../../database/schema';

export class ListJobRunsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() name?: string;
}

export class ListEmailsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(EMAIL_STATUSES) status?: EmailStatus;
}

export class UpdateJobScheduleDto {
  @IsOptional() @IsString() @MaxLength(120) cronExpression?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
