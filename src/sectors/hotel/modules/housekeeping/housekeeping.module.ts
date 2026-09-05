import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';

@Module({
  imports: [RoomsModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
