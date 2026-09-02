import { Injectable } from '@nestjs/common';
import { EmailOutboxRepository } from '../../email/email-outbox.repository';
import { EmailService } from '../../email/email.service';
import type { JobDetail } from './job-runner.service';

const BATCH = 25;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class EmailOutboxJob {
  static readonly NAME = 'email-outbox';

  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly email: EmailService,
  ) {}

  async run(): Promise<JobDetail> {
    const due = await this.outbox.claimDue(BATCH);

    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const row of due) {
      try {
        await this.email.deliver(row);
        await this.outbox.markSent(row.id);
        sent += 1;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);

        if (row.attempts >= row.maxAttempts) {
          await this.outbox.markFailed(row.id, message);
          failed += 1;
          continue;
        }

        const delay = Math.min(
          BASE_BACKOFF_MS * 2 ** (row.attempts - 1),
          MAX_BACKOFF_MS,
        );

        await this.outbox.markRetry(
          row.id,
          message,
          new Date(Date.now() + delay),
        );
        retried += 1;
      }
    }

    return { claimed: due.length, sent, retried, failed };
  }
}
