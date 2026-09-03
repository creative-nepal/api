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
import { CurrentUser, type CurrentUserType } from '../../../../auth';
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
import type {
  Branch,
  Business,
  Reservation,
} from '../../../../database/schema';
import {
  CreateReservationDto,
  ListReservationsQueryDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller({ path: 'businesses/:businessId/reservations', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequireSectorGuard,
  RequirePermissionGuard,
  BranchScopeGuard,
)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermission({ reservation: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListReservationsQueryDto,
  ): Promise<PaginatedResult<Reservation>> {
    return this.reservationsService.list({
      businessId: business.id,
      branchId: branch.id,
      ...query,
    });
  }

  @Get(':reservationId')
  @RequirePermission({ reservation: ['view'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
  ): Promise<Reservation> {
    return this.reservationsService.getById(business.id, reservationId);
  }

  @Post()
  @RequirePermission({ reservation: ['book'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateReservationDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<Reservation> {
    return this.reservationsService.create(
      business,
      branch.id,
      dto,
      currentUser.id,
    );
  }

  @Patch(':reservationId')
  @RequirePermission({ reservation: ['book'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.update(business.id, reservationId, dto);
  }

  @Post(':reservationId/seat')
  @RequirePermission({ reservation: ['seat'] })
  async seat(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
    @Body() body: { tableId?: string },
  ): Promise<Reservation> {
    return this.reservationsService.seat(
      business.id,
      reservationId,
      body?.tableId,
    );
  }

  @Post(':reservationId/complete')
  @RequirePermission({ reservation: ['seat'] })
  async complete(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
  ): Promise<Reservation> {
    return this.reservationsService.close(
      business.id,
      reservationId,
      'completed',
    );
  }

  @Post(':reservationId/no-show')
  @RequirePermission({ reservation: ['cancel'] })
  async noShow(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
  ): Promise<Reservation> {
    return this.reservationsService.close(
      business.id,
      reservationId,
      'no_show',
    );
  }

  @Post(':reservationId/cancel')
  @RequirePermission({ reservation: ['cancel'] })
  async cancel(
    @CurrentBusiness() business: Business,
    @Param('reservationId') reservationId: string,
  ): Promise<Reservation> {
    return this.reservationsService.close(
      business.id,
      reservationId,
      'cancelled',
    );
  }
}
