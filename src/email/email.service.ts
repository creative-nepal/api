import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { brandName, defaultEmailFrom } from './brand';
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
    await this.send({
      to,
      subject: `Reset your ${this.brand} password`,
      react: ResetPasswordEmail(props),
    });
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

    await this.send({
      to,
      subject: subjectByType[props.type],
      react: OtpVerificationEmail(props),
    });
  }

  async sendOrganizationInvitationEmail(
    to: string,
    props: OrganizationInvitationEmailProps,
  ): Promise<void> {
    await this.send({
      to,
      subject: `You have been invited to join ${props.organizationName}`,
      react: OrganizationInvitationEmail(props),
    });
  }

  private async send({
    to,
    subject,
    react,
  }: {
    to: string;
    subject: string;
    react: ReactElement;
  }): Promise<void> {
    if (!this.resend) {
      const html = await render(react);
      this.logger.warn(
        `RESEND_API_KEY is not set — logging email instead of sending. To: ${to}, Subject: ${subject}`,
      );
      this.logger.debug(html);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      react,
    });

    if (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.name} - ${error.message}`,
      );
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
