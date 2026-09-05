import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import {
  HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type HousekeepingTask,
} from '../../../../../database/schema';

export class CreateHousekeepingTaskDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  forDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateHousekeepingTaskDto {
  @IsOptional()
  @IsIn(HOUSEKEEPING_STATUSES)
  status?: HousekeepingStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListHousekeepingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(HOUSEKEEPING_STATUSES)
  status?: HousekeepingStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  forDate?: string;
}

export class HousekeepingTaskResponseDto {
  id: string;
  roomId: string;
  roomNo: string | null;
  forDate: string;
  status: string;
  assignedUserId: string | null;
  note: string | null;
  completedAt: Date | null;

  constructor(task: HousekeepingTask, roomNo: string | null = null) {
    this.id = task.id;
    this.roomId = task.roomId;
    this.roomNo = roomNo;
    this.forDate = task.forDate;
    this.status = task.status;
    this.assignedUserId = task.assignedUserId;
    this.note = task.note;
    this.completedAt = task.completedAt;
  }
}
