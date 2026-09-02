import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { getDb } from '../database/client';
import type { EmailOutboxRow, EmailTemplate } from '../database/schema';
import { emailOutbox } from '../database/schema/operations';
import { brandName, defaultEmailFrom } from './brand';
import { NotificationDigestEmail } from './templates/notification-digest-email';
import type { NotificationDigestEmailProps } from './templates/notification-digest-email';
import { OrganizationInvitationEmail } from './templates/organization-invitation-email';
import type { OrganizationInvitationEmailProps } from './templates/organization-invitation-email';
import { OtpVerificationEmail } from './templates/otp-verification-email';
import type { OtpVerificationEmailProps } from './templates/otp-verification-email';
import { ResetPasswordEmail } from './templates/reset-password-email';
import type { ResetPasswordEmailProps } from './templates/reset-password-email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly brand: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.EMAIL_FROM ?? defaultEmailFrom();
    this.brand = brandName();
  }

  async sendResetPasswordEmail(
    to: string,
    props: ResetPasswordEmailProps,
  ): Promise<void> {
    await this.enqueue(
      to,
      `Reset your ${this.brand} password`,
      'reset-password',
      props,
    );
  }

  async sendOtpVerificationEmail(
    to: string,
    props: OtpVerificationEmailProps,
  ): Promise<void> {
    const subjectByType: Record<OtpVerificationEmailProps['type'], string> = {
      'sign-in': `Your ${this.brand} sign-in code`,
      'email-verification': `Verify your ${this.brand} email address`,
      'forget-password': `Your ${this.brand} password reset code`,
      'change-email': `Confirm your new ${this.brand} email address`,
    };

    await this.enqueue(
      to,
      subjectByType[props.type],
      'otp-verification',
      props,
    );
  }

  async sendOrganizationInvitationEmail(
    to: string,
    props: OrganizationInvitationEmailProps,
  ): Promise<void> {
    await this.enqueue(
      to,
      `You have been invited to join ${props.organizationName}`,
      'organization-invitation',
      props,
    );
  }

  async sendNotificationDigestEmail(
    to: string,
    props: NotificationDigestEmailProps,
  ): Promise<void> {
    await this.enqueue(
      to,
      `${props.businessName} — ${props.items.length} update(s)`,
      'notification-digest',
      props,
    );
  }

  private async enqueue(
    recipient: string,
    subject: string,
    template: EmailTemplate,
    payload: object,
  ): Promise<void> {
    await getDb()
      .insert(emailOutbox)
      .values({
        id: randomUUID(),
        recipient,
        subject,
        template,
        payload: payload as Record<string, unknown>,
        status: 'pending',
      });
  }

  async deliver(row: EmailOutboxRow): Promise<void> {
    const react = this.renderFor(row);

    if (!this.resend) {
      const html = await render(react);
      this.logger.warn(
        `RESEND_API_KEY is not set — logging email instead of sending. To: ${row.recipient}, Subject: ${row.subject}`,
      );
      this.logger.debug(html);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: row.recipient,
      subject: row.subject,
      react,
    });

    if (error) {
      throw new Error(`${error.name}: ${error.message}`);
    }
  }

  private renderFor(row: EmailOutboxRow): ReactElement {
    switch (row.template as EmailTemplate) {
      case 'reset-password':
        return ResetPasswordEmail(
          row.payload as unknown as ResetPasswordEmailProps,
        );
      case 'otp-verification':
        return OtpVerificationEmail(
          row.payload as unknown as OtpVerificationEmailProps,
        );
      case 'organization-invitation':
        return OrganizationInvitationEmail(
          row.payload as unknown as OrganizationInvitationEmailProps,
        );
      case 'notification-digest':
        return NotificationDigestEmail(
          row.payload as unknown as NotificationDigestEmailProps,
        );
      default:
        throw new Error(`Unknown email template: ${row.template}`);
    }
  }
}
