import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { BusinessScopedRequest } from '../../common/decorators/current-business.decorator';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business, CalendarEvent } from '../../database/schema';
import { CalendarService, type CalendarEntry } from './calendar.service';
import {
  BikramSambatMonthQueryDto,
  CalendarFeedQueryDto,
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';
import { Req } from '@nestjs/common';

@Controller({ path: 'businesses/:businessId/calendar', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @RequirePermission({ calendar: ['view'] })
  async feed(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: CalendarFeedQueryDto,
    @Req() request: BusinessScopedRequest,
  ): Promise<CalendarEntry[]> {
    return this.calendarService.feed(
      business,
      currentUser.id,
      request.access?.allowedBranchIds ?? null,
      query,
    );
  }

  @Get('bs-month')
  @RequirePermission({ calendar: ['view'] })
  month(@Query() query: BikramSambatMonthQueryDto) {
    return this.calendarService.month(query.year, query.month);
  }

  @Get('events')
  @RequirePermission({ calendar: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: ListCalendarEventsQueryDto,
  ): Promise<PaginatedResult<CalendarEvent>> {
    return this.calendarService.list(business, currentUser.id, query);
  }

  @Post('events')
  @RequirePermission({ calendar: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEvent> {
    return this.calendarService.create(business, currentUser.id, dto);
  }

  @Patch('events/:eventId')
  @RequirePermission({ calendar: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEvent> {
    return this.calendarService.update(business, currentUser.id, eventId, dto);
  }

  @Delete('events/:eventId')
  @RequirePermission({ calendar: ['manage'] })
  async remove(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Param('eventId') eventId: string,
  ): Promise<{ id: string }> {
    return this.calendarService.remove(business, currentUser.id, eventId);
  }
}
