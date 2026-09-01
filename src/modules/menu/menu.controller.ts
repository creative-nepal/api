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
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business } from '../../database/schema';
import {
  CreateMenuItemDto,
  ListMenuQueryDto,
  MenuItemResponseDto,
  SetAvailabilityDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import { MenuService } from './menu.service';

@Controller({ path: 'businesses/:businessId/menu', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListMenuQueryDto,
  ): Promise<PaginatedResult<MenuItemResponseDto>> {
    const result = await this.menuService.list({
      businessId: business.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((item) => new MenuItemResponseDto(item)),
    };
  }

  @Get(':menuItemId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('menuItemId') menuItemId: string,
  ): Promise<MenuItemResponseDto> {
    return new MenuItemResponseDto(
      await this.menuService.getById(business.id, menuItemId),
    );
  }

  @Post()
  @RequirePermission({ product: ['create'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return new MenuItemResponseDto(
      await this.menuService.create(business, dto),
    );
  }

  @Patch(':menuItemId')
  @RequirePermission({ product: ['update'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return new MenuItemResponseDto(
      await this.menuService.update(business, menuItemId, dto),
    );
  }

  @Patch(':menuItemId/availability')
  @RequirePermission({ kot: ['update'] })
  async setAvailability(
    @CurrentBusiness() business: Business,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: SetAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    return new MenuItemResponseDto(
      await this.menuService.setAvailability(
        business.id,
        menuItemId,
        dto.isAvailable,
      ),
    );
  }
}
