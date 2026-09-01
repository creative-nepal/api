import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { PlatformBillingService } from './platform-billing.service';

@Injectable()
export class PlatformBillingScheduler {
  constructor(
    private readonly logger: PinoLogger,
    private readonly billingService: PlatformBillingService,
  ) {
    this.logger.setContext(PlatformBillingScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'platform-billing' })
  async runNightly(): Promise<void> {
    const summary = await this.billingService.runBilling();

    this.logger.info(summary, 'Platform billing run complete');
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'platform-invoice-consolidation',
  })
  async consolidateMonthly(): Promise<void> {
    const closed = await this.billingService.consolidate();
    this.logger.info({ closed }, 'Consolidated platform invoices');
  }
}
