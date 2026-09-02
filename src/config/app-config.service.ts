import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  /** Explicit `LOG_LEVEL` wins; otherwise debug locally, info in prod, silent under Jest. */
  get logLevel(): string {
    const explicit = this.configService.get('LOG_LEVEL', { infer: true });
    if (explicit) {
      return explicit;
    }

    if (this.isTest) {
      return 'silent';
    }

    return this.isProduction ? 'info' : 'debug';
  }

  /** Human-readable `pino-pretty` output outside production/test; structured JSON otherwise. */
  get logPretty(): boolean {
    return !this.isProduction && !this.isTest;
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get betterAuthSecret(): string {
    return this.configService.get('BETTER_AUTH_SECRET', { infer: true });
  }

  get betterAuthUrl(): string {
    return this.configService.get('BETTER_AUTH_URL', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.configService.get('CORS_ORIGINS', { infer: true });
  }

  get googleClientId(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get googleClientSecret(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  get resendApiKey(): string | undefined {
    return this.configService.get('RESEND_API_KEY', { infer: true });
  }

  get emailFrom(): string {
    return this.configService.get('EMAIL_FROM', { infer: true });
  }

  get invitationAcceptUrl(): string {
    return this.configService.get('INVITATION_ACCEPT_URL', { infer: true });
  }

  get contentPreviewSecret(): string | undefined {
    return this.configService.get('CONTENT_PREVIEW_SECRET', { infer: true });
  }

  get webRevalidateUrl(): string | undefined {
    return this.configService.get('WEB_REVALIDATE_URL', { infer: true });
  }

  get webRevalidateSecret(): string | undefined {
    return this.configService.get('WEB_REVALIDATE_SECRET', { infer: true });
  }

  get sectorsEnabled(): string | undefined {
    return this.configService.get('SECTORS_ENABLED', { infer: true });
  }

  get brandName(): string {
    return this.configService.get('BRAND_NAME', { infer: true });
  }

  get brandSupportEmail(): string | undefined {
    return this.configService.get('BRAND_SUPPORT_EMAIL', { infer: true });
  }
}
