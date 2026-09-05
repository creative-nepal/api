import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../../../database/schema';
import {
  CreateRoomDto,
  CreateRoomTypeDto,
  ListRoomsQueryDto,
  RoomResponseDto,
  RoomTypeResponseDto,
  UpdateRoomDto,
  UpdateRoomTypeDto,
} from './dto/room.dto';
import { RoomsService } from './rooms.service';

@Controller({ path: 'businesses/:businessId', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequirePermissionGuard,
  RequireSectorGuard,
  BranchScopeGuard,
)
@RequireSector('hotel')
@UseInterceptors(ClassSerializerInterceptor)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('room-types')
  async listTypes(
    @CurrentBusiness() business: Business,
  ): Promise<RoomTypeResponseDto[]> {
    const types = await this.roomsService.listTypes(business.id);

    return types.map((type) => new RoomTypeResponseDto(type));
  }

  @Post('room-types')
  @RequirePermission({ room: ['manage'] })
  async createType(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    return new RoomTypeResponseDto(
      await this.roomsService.createType(business, dto),
    );
  }

  @Patch('room-types/:roomTypeId')
  @RequirePermission({ room: ['manage'] })
  async updateType(
    @CurrentBusiness() business: Business,
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    return new RoomTypeResponseDto(
      await this.roomsService.updateType(business, roomTypeId, dto),
    );
  }

  @Get('rooms')
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListRoomsQueryDto,
  ): Promise<PaginatedResult<RoomResponseDto>> {
    const result = await this.roomsService.list(business.id, branch.id, query);

    return {
      ...result,
      data: result.data.map(
        (row) => new RoomResponseDto(row.room, row.roomType),
      ),
    };
  }

  @Post('rooms')
  @RequirePermission({ room: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomResponseDto> {
    return new RoomResponseDto(
      await this.roomsService.create(business, branch.id, dto),
    );
  }

  @Patch('rooms/:roomId')
  @RequirePermission({ room: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    return new RoomResponseDto(
      await this.roomsService.update(business, roomId, dto),
    );
  }
}
