import { z } from 'zod';
import { isSectorKey, SECTOR_KEYS } from '../database/schema/sector-keys';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Creative Nepal <onboarding@resend.dev>'),
  INVITATION_ACCEPT_URL: z
    .string()
    .default('http://localhost:3000/accept-invitation'),

  CONTENT_PREVIEW_SECRET: z.string().min(16).optional(),
  WEB_REVALIDATE_URL: z.string().optional(),
  WEB_REVALIDATE_SECRET: z.string().min(16).optional(),

  DATABASE_SSL: z.enum(['true', 'false']).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),

  SECTORS_ENABLED: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value?.trim() ||
        value
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean)
          .every(isSectorKey),
      {
        message: `SECTORS_ENABLED must be a comma-separated subset of: ${SECTOR_KEYS.join(', ')}`,
      },
    ),

  BRAND_NAME: z.string().default('Creative Nepal'),
  BRAND_SUPPORT_EMAIL: z.string().optional(),
});

function assertProductionReady(env: Env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (!env.RESEND_API_KEY) {
    problems.push(
      'RESEND_API_KEY is required in production — without it password resets, OTPs and staff invitations are logged instead of sent',
    );
  }

  if (env.CORS_ORIGINS.length === 0) {
    problems.push(
      'CORS_ORIGINS must list the exact origins allowed to call the API; an empty list falls back to reflecting any origin',
    );
  }

  if (env.BETTER_AUTH_URL.startsWith('http://')) {
    problems.push('BETTER_AUTH_URL must be https in production');
  }

  if (env.INVITATION_ACCEPT_URL.startsWith('http://')) {
    problems.push('INVITATION_ACCEPT_URL must be https in production');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${result.error.message}`,
    );
  }

  assertProductionReady(result.data);

  return result.data;
}
