import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  Business,
  ServiceAppointment,
  StaffAvailability,
  StaffTimeOff,
} from '../../../../database/schema';
import { AvailabilityService } from './availability.service';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateTimeOffDto,
  ListAppointmentsQueryDto,
  RecordDepositDto,
  SetAvailabilityDto,
  UpdateAppointmentStatusDto,
} from './dto/appointments.dto';

@Controller({ path: 'businesses/:businessId/appointments', version: '1' })
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('services')
@UseInterceptors(ClassSerializerInterceptor)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get()
  @RequirePermission({ appointment: ['complete'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<PaginatedResult<ServiceAppointment>> {
    return this.appointmentsService.list(business.id, query);
  }

  @Post()
  @RequirePermission({ appointment: ['book'] })
  async book(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateAppointmentDto,
  ): Promise<ServiceAppointment> {
    return this.appointmentsService.book(business.id, dto);
  }

  @Get('availability/:staffUserId')
  @RequirePermission({ appointment: ['complete'] })
  async getAvailability(
    @CurrentBusiness() business: Business,
    @Param('staffUserId') staffUserId: string,
  ): Promise<StaffAvailability[]> {
    return this.availability.listFor(business.id, staffUserId);
  }

  @Put('availability/:staffUserId')
  @RequirePermission({ membership: ['manage'] })
  async setAvailability(
    @CurrentBusiness() business: Business,
    @Param('staffUserId') staffUserId: string,
    @Body() dto: SetAvailabilityDto,
  ): Promise<StaffAvailability[]> {
    return this.availability.setFor(business.id, staffUserId, dto.windows);
  }

  @Post('availability/:staffUserId/time-off')
  @RequirePermission({ membership: ['manage'] })
  async addTimeOff(
    @CurrentBusiness() business: Business,
    @Param('staffUserId') staffUserId: string,
    @Body() dto: CreateTimeOffDto,
  ): Promise<StaffTimeOff> {
    return this.availability.addTimeOff(
      business.id,
      staffUserId,
      new Date(dto.startsAt),
      new Date(dto.endsAt),
      dto.reason ?? null,
    );
  }

  @Get(':appointmentId')
  @RequirePermission({ appointment: ['complete'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('appointmentId') appointmentId: string,
  ): Promise<ServiceAppointment> {
    return this.appointmentsService.getById(business.id, appointmentId);
  }

  @Post(':appointmentId/deposit')
  @RequirePermission({ appointment: ['book'] })
  async recordDeposit(
    @CurrentBusiness() business: Business,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: RecordDepositDto,
  ): Promise<ServiceAppointment> {
    return this.appointmentsService.recordDeposit(
      business.id,
      appointmentId,
      dto,
    );
  }

  @Patch(':appointmentId/status')
  @RequirePermission({ appointment: ['complete'] })
  async setStatus(
    @CurrentBusiness() business: Business,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<ServiceAppointment> {
    return this.appointmentsService.setStatus(
      business.id,
      appointmentId,
      dto.status,
    );
  }
}
