import { Module } from '@nestjs/common';
import { EmailOutboxRepository } from './email-outbox.repository';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService, EmailOutboxRepository],
  exports: [EmailService, EmailOutboxRepository],
})
export class EmailModule {}
