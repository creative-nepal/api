import { Injectable } from '@nestjs/common';
import { InvoiceLeasesService } from '../../sync/invoice-leases.service';
import type { JobDetail } from '../job-runner.service';

@Injectable()
export class InvoiceLeaseExpiryJob {
  static readonly NAME = 'invoice-lease-expiry';

  constructor(private readonly leases: InvoiceLeasesService) {}

  async run(): Promise<JobDetail> {
    const closed = await this.leases.expireStaleLeases();
    return { closed };
  }
}
