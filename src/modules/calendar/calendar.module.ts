import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarCoreModule } from './calendar-core.module';

@Module({
  imports: [CalendarCoreModule],
  controllers: [CalendarController],
})
export class CalendarModule {}
