import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsCoreModule } from './notifications-core.module';

@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
  exports: [NotificationsCoreModule],
})
export class NotificationsModule {}
