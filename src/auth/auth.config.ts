import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { lastLoginMethod } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { organization } from 'better-auth/plugins/organization';
import { localization } from 'better-auth-localization';
import { getDb } from '../database/client';
import { EmailService } from '../email/email.service';
import { ac, platformAc, platformRoles, roles } from './access-control';
import { authLocalization } from './auth-localization';
import {
  organizationHooks,
  resolveMembershipLimit,
} from './organization-hooks';

const emailService = new EmailService();

const ORGANIZATION_LIMIT = 5;

const DEFAULT_INVITATION_ACCEPT_URL = 'http://localhost:3000/accept-invitation';

function invitationAcceptUrl(invitationId: string): string {
  const base =
    process.env.INVITATION_ACCEPT_URL ?? DEFAULT_INVITATION_ACCEPT_URL;
  return `${base}?invitationId=${encodeURIComponent(invitationId)}`;
}

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: ({ user, url }) =>
      emailService.sendResetPasswordEmail(user.email, {
        name: user.name,
        url,
      }),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    localization(authLocalization),
    admin({ ac: platformAc, roles: platformRoles }),
    emailOTP({
      sendVerificationOTP: ({ email, otp, type }) =>
        emailService.sendOtpVerificationEmail(email, { otp, type }),
    }),
    passkey(),
    lastLoginMethod(),
    organization({
      teams: { enabled: true },
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 20,
      },
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      ac,
      roles,
      organizationLimit: ORGANIZATION_LIMIT,
      membershipLimit: (_user, org) => resolveMembershipLimit(org.id),
      disableOrganizationDeletion: true,
      organizationHooks,
      sendInvitationEmail: (data) =>
        emailService.sendOrganizationInvitationEmail(data.email, {
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          role: data.role,
          url: invitationAcceptUrl(data.id),
        }),
    }),
    expo(),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  trustedOrigins: [
    ...(
      process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001'
    )
      .split(',')
      .map((origin) => origin.trim()),
    'mobile://',
    process.env.BETTER_AUTH_URL,
    ...(process.env.NODE_ENV === 'development'
      ? ['exp://', 'exp://**', 'exp://192.168.*.*:*/**']
      : []),
  ].filter((origin): origin is string => Boolean(origin)),
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
