import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
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
import type { Branch, Business } from '../../../../database/schema';
import { RoomsService } from '../rooms/rooms.service';
import {
  BookingResponseDto,
  CheckInDto,
  CreateBookingDto,
  FolioPostingResponseDto,
  ListBookingsQueryDto,
  PostToFolioDto,
} from './dto/booking.dto';
import { FrontDeskService } from './front-desk.service';

@Controller({ path: 'businesses/:businessId/bookings', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequirePermissionGuard,
  RequireSectorGuard,
  BranchScopeGuard,
)
@RequireSector('hotel')
@UseInterceptors(ClassSerializerInterceptor)
export class FrontDeskController {
  constructor(
    private readonly frontDesk: FrontDeskService,
    private readonly rooms: RoomsService,
  ) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListBookingsQueryDto,
  ): Promise<PaginatedResult<BookingResponseDto>> {
    const result = await this.frontDesk.list(business.id, branch.id, query);

    const data = await Promise.all(
      result.data.map(async (reservation) =>
        this.toDto(business.id, reservation),
      ),
    );

    return { ...result, data };
  }

  @Get(':bookingId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
  ): Promise<BookingResponseDto> {
    return this.toDto(
      business.id,
      await this.frontDesk.getById(business.id, bookingId),
    );
  }

  @Get(':bookingId/folio')
  async folio(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
  ): Promise<FolioPostingResponseDto[]> {
    const postings = await this.frontDesk.postings(business.id, bookingId);

    return postings.map((posting) => new FolioPostingResponseDto(posting));
  }

  @Post()
  @RequirePermission({ booking: ['book'] })
  async book(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateBookingDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BookingResponseDto> {
    return this.toDto(
      business.id,
      await this.frontDesk.book(business, branch.id, dto, currentUser.id),
    );
  }

  @Post(':bookingId/check-in')
  @RequirePermission({ booking: ['check-in'] })
  async checkIn(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
    @Body() dto: CheckInDto,
  ): Promise<BookingResponseDto> {
    return this.toDto(
      business.id,
      await this.frontDesk.checkIn(business, bookingId, dto),
    );
  }

  @Post(':bookingId/folio')
  @RequirePermission({ folio: ['post'] })
  async postCharge(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
    @Body() dto: PostToFolioDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<FolioPostingResponseDto> {
    return new FolioPostingResponseDto(
      await this.frontDesk.post(business, bookingId, dto, currentUser.id),
    );
  }

  @Post(':bookingId/check-out')
  @RequirePermission({ booking: ['check-out'] })
  async checkOut(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ booking: BookingResponseDto; invoiceId: string }> {
    const result = await this.frontDesk.checkOut(
      business,
      bookingId,
      currentUser.id,
    );

    return {
      booking: await this.toDto(business.id, result.reservation),
      invoiceId: result.invoice.id,
    };
  }

  @Post(':bookingId/cancel')
  @RequirePermission({ booking: ['cancel'] })
  async cancel(
    @CurrentBusiness() business: Business,
    @Param('bookingId') bookingId: string,
  ): Promise<BookingResponseDto> {
    return this.toDto(
      business.id,
      await this.frontDesk.cancel(business, bookingId),
    );
  }

  private async toDto(
    businessId: string,
    reservation: Parameters<FrontDeskService['totalsFor']>[1],
  ): Promise<BookingResponseDto> {
    const totals = await this.frontDesk.totalsFor(businessId, reservation);

    const roomNo = reservation.roomId
      ? (await this.rooms.getById(businessId, reservation.roomId)).roomNo
      : null;

    return new BookingResponseDto(reservation, totals, roomNo);
  }
}
