import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import {
  type Room,
  ROOM_STATUSES,
  type RoomStatus,
  type RoomType,
} from '../../../../../database/schema';

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseRateCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxOccupancy?: number;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseRateCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxOccupancy?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  roomNo!: string;

  @IsString()
  @IsNotEmpty()
  roomTypeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  floor?: string;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  roomNo?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  floor?: string;

  @IsOptional()
  @IsIn(ROOM_STATUSES)
  status?: RoomStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListRoomsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ROOM_STATUSES)
  status?: RoomStatus;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class RoomTypeResponseDto {
  id: string;
  name: string;
  baseRateCents: number;
  maxOccupancy: number;
  isActive: boolean;

  constructor(roomType: RoomType) {
    this.id = roomType.id;
    this.name = roomType.name;
    this.baseRateCents = roomType.baseRateCents;
    this.maxOccupancy = roomType.maxOccupancy;
    this.isActive = roomType.isActive;
  }
}

export class RoomResponseDto {
  id: string;
  businessId: string;
  branchId: string;
  roomNo: string;
  floor: string | null;
  roomTypeId: string;
  roomTypeName: string | null;
  baseRateCents: number | null;
  status: string;
  isActive: boolean;

  constructor(room: Room, roomType?: RoomType | null) {
    this.id = room.id;
    this.businessId = room.businessId;
    this.branchId = room.branchId;
    this.roomNo = room.roomNo;
    this.floor = room.floor;
    this.roomTypeId = room.roomTypeId;
    this.roomTypeName = roomType?.name ?? null;
    this.baseRateCents = roomType?.baseRateCents ?? null;
    this.status = room.status;
    this.isActive = room.isActive;
  }
}
