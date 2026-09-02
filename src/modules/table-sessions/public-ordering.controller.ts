import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Business, RestaurantTable } from '../../database/schema';
import { MenuItemResponseDto } from '../menu/dto/menu.dto';
import { MenuService } from '../menu/menu.service';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { BranchesService } from '../branches/branches.service';
import { OrdersService } from '../orders/orders.service';
import {
  CreateTableSessionDto,
  PlaceQrOrderDto,
} from './dto/table-session.dto';
import {
  CurrentTable,
  CurrentTableBusiness,
  TableSessionGuard,
} from './table-session.guard';
import { TableSessionsService } from './table-sessions.service';

@Controller({ path: 'public', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class PublicOrderingController {
  constructor(
    private readonly tableSessionsService: TableSessionsService,
    private readonly menuService: MenuService,
    private readonly ordersService: OrdersService,
    private readonly branchesService: BranchesService,
  ) {}

  @Post('table-sessions')
  @AllowAnonymous()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async createSession(@Body() dto: CreateTableSessionDto) {
    const issued = await this.tableSessionsService.issue(
      dto.businessId,
      dto.tableId,
    );

    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      tableId: issued.tableId,
    };
  }

  @Get('menu')
  @AllowAnonymous()
  @UseGuards(TableSessionGuard)
  async menu(
    @CurrentTableBusiness() business: Business,
  ): Promise<MenuItemResponseDto[]> {
    const result = await this.menuService.list({
      businessId: business.id,
      limit: 200,
      offset: 0,
      availableOnly: true,
    });

    return result.data.map((item) => new MenuItemResponseDto(item));
  }

  @Post('orders')
  @AllowAnonymous()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseGuards(TableSessionGuard)
  async placeOrder(
    @CurrentTableBusiness() business: Business,
    @CurrentTable() table: RestaurantTable,
    @Body() dto: PlaceQrOrderDto,
  ): Promise<OrderResponseDto> {
    await this.tableSessionsService.assertOrderQuotaAvailable(
      business.id,
      table.id,
    );

    const branch = await this.branchesService.getById(
      business.id,
      table.branchId,
    );

    const { order, items } = await this.ordersService.checkout({
      business,
      branch,
      dto: { items: dto.items, tableId: table.id, source: 'qr' },
      actorUserId: null,
      headers: {},
    });

    return new OrderResponseDto(order, items, null);
  }

  @Get('orders')
  @AllowAnonymous()
  @UseGuards(TableSessionGuard)
  async myOrders(
    @CurrentTableBusiness() business: Business,
    @CurrentTable() table: RestaurantTable,
  ): Promise<OrderResponseDto[]> {
    const orders = await this.ordersService.listForTable(business.id, table.id);
    return orders.map((order) => new OrderResponseDto(order));
  }
}
