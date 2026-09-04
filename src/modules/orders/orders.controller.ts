import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../database/schema';
import { CreateOrderDto, ListOrdersQueryDto } from './dto/order-request.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';
import { ExportQueryDto, sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import { OrdersExportService } from './orders-export.service';

@Controller({ path: 'businesses/:businessId/orders', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly exportService: OrdersExportService,
  ) {}

  @Get('export')
  @RequirePermission({ invoice: ['print'] })
  async export(
    @CurrentBusiness() business: Business,
    @Query() query: ExportQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.exportService.export(
        business,
        query.format ?? 'xlsx',
        query,
        query.limit ?? 10_000,
      ),
    );
  }

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const result = await this.ordersService.list({
      businessId: business.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((order) => new OrderResponseDto(order)),
    };
  }

  @Get(':orderId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    const { order, items, invoice } = await this.ordersService.getById(
      business.id,
      orderId,
    );
    return new OrderResponseDto(order, items, invoice);
  }

  @Post()
  @RequirePermission({ order: ['create'] })
  async checkout(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateOrderDto,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ): Promise<OrderResponseDto> {
    const { order, items, invoice } = await this.ordersService.checkout({
      business,
      branch,
      dto,
      actorUserId: currentUser.id,
      headers: request.headers,
    });
    return new OrderResponseDto(order, items, invoice);
  }
}
