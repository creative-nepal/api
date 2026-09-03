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
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type { Business, ServiceAppointment } from '../../../../database/schema';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from './dto/appointments.dto';

@Controller({ path: 'businesses/:businessId/appointments', version: '1' })
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('services')
@UseInterceptors(ClassSerializerInterceptor)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

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

  @Get(':appointmentId')
  @RequirePermission({ appointment: ['complete'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('appointmentId') appointmentId: string,
  ): Promise<ServiceAppointment> {
    return this.appointmentsService.getById(business.id, appointmentId);
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
