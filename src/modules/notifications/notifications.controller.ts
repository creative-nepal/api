import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import { BusinessAccessGuard, CurrentBusiness } from '../../common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business } from '../../database/schema';
import type { NotificationView } from './notifications.service';
import { NotificationsService } from './notifications.service';

@Controller({ path: 'businesses/:businessId/notifications', version: '1' })
@UseGuards(BusinessAccessGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<NotificationView>> {
    return this.notifications.list(
      business.id,
      currentUser.id,
      query.limit,
      query.offset,
    );
  }

  @Get('unread-count')
  async unreadCount(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ unread: number }> {
    return {
      unread: await this.notifications.unreadCount(business.id, currentUser.id),
    };
  }

  @Post(':notificationId/read')
  async markRead(
    @CurrentBusiness() _business: Business,
    @CurrentUser() currentUser: CurrentUserType,
    @Param('notificationId') notificationId: string,
  ): Promise<{ id: string; read: true }> {
    await this.notifications.markRead(notificationId, currentUser.id);
    return { id: notificationId, read: true };
  }

  @Post('read-all')
  async markAllRead(
    @CurrentBusiness() business: Business,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ marked: number }> {
    return {
      marked: await this.notifications.markAllRead(business.id, currentUser.id),
    };
  }
}
