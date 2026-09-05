import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
