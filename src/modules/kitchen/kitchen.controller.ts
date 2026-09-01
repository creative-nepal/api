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
import type { Business } from '../../database/schema';
import {
  KitchenTicketResponseDto,
  ListTicketsQueryDto,
  UpdateTicketStatusDto,
} from './dto/kitchen.dto';
import { KitchenService } from './kitchen.service';

@Controller({ path: 'businesses/:businessId/kitchen', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('tickets')
  @RequirePermission({ kot: ['view'] })
  async listTickets(
    @CurrentBusiness() business: Business,
    @Query() query: ListTicketsQueryDto,
  ): Promise<KitchenTicketResponseDto[]> {
    const tickets = await this.kitchenService.listTickets(business.id, query);
    return tickets.map(
      (entry) => new KitchenTicketResponseDto(entry.ticket, entry.items),
    );
  }

  @Patch('tickets/:ticketId/status')
  @RequirePermission({ kot: ['update'] })
  async updateStatus(
    @CurrentBusiness() business: Business,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<{ id: string; status: string }> {
    const updated = await this.kitchenService.updateTicketStatus(
      business.id,
      ticketId,
      dto.status,
    );
    return { id: updated.id, status: updated.status };
  }
}

@Controller({ path: 'businesses/:businessId/orders', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class OrderLifecycleController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Post(':orderId/confirm')
  @RequirePermission({ order: ['confirm'] })
  async confirm(
    @CurrentBusiness() business: Business,
    @Param('orderId') orderId: string,
  ): Promise<{
    orderId: string;
    tickets: Array<{ id: string; station: string }>;
  }> {
    const tickets = await this.kitchenService.confirmOrder(
      business.id,
      orderId,
    );

    return {
      orderId,
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        station: ticket.station,
      })),
    };
  }
}
