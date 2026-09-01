import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentGateway } from './gateway/payment-gateway.interface';
import { StubPaymentGateway } from './gateway/stub-payment.gateway';
import { PaymentMethodsService } from './payment-methods.service';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingRepository } from './platform-billing.repository';
import { PlatformBillingScheduler } from './platform-billing.scheduler';
import { PlatformBillingService } from './platform-billing.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PlatformBillingController],
  providers: [
    PlatformBillingService,
    PlatformBillingRepository,
    PaymentMethodsService,
    PlatformBillingScheduler,
    { provide: PaymentGateway, useClass: StubPaymentGateway },
  ],
  exports: [PlatformBillingService],
})
export class PlatformBillingModule {}
