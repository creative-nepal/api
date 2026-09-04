import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsCoreModule } from './referrals-core.module';

@Module({
  imports: [ReferralsCoreModule],
  controllers: [ReferralsController],
  exports: [ReferralsCoreModule],
})
export class ReferralsModule {}
