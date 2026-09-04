import { Module } from '@nestjs/common';
import { FeedbackController, LoyaltyController } from './loyalty.controller';
import { LoyaltyCoreModule } from './loyalty-core.module';

@Module({
  imports: [LoyaltyCoreModule],
  controllers: [LoyaltyController, FeedbackController],
})
export class LoyaltyModule {}
