import { randomUUID } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../database/client';
import {
  businesses,
  plans,
  SECTORS,
  subscriptions,
} from '../database/schema/billing';

const DEFAULT_MEMBERSHIP_LIMIT = 5;
const DEFAULT_FISCAL_YEAR_START_MONTH = 4;

const businessMetadataSchema = z.object({
  sector: z.enum(SECTORS),
  legalName: z.string().trim().min(1).max(255).optional(),
  panNumber: z.string().trim().min(1).max(32).optional(),
  vatRegistered: z.coerce.boolean().optional(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type BusinessMetadata = z.infer<typeof businessMetadataSchema>;

function parseBusinessMetadata(raw: unknown) {
  const value = typeof raw === 'string' ? safeJsonParse(raw) : raw;
  return businessMetadataSchema.safeParse(value ?? {});
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export const organizationHooks = {
  beforeCreateOrganization: (data: {
    organization: Record<string, unknown> & { name?: string };
  }): Promise<void> => {
    const parsed = parseBusinessMetadata(data.organization.metadata);

    if (!parsed.success) {
      throw new APIError('BAD_REQUEST', {
        message:
          `An organization is a business and needs valid metadata. Expected ` +
          `metadata.sector to be one of: ${SECTORS.join(', ')}.`,
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }

    return Promise.resolve();
  },

  afterCreateOrganization: async (data: {
    organization: Record<string, unknown> & { id: string; name: string };
  }) => {
    const parsed = parseBusinessMetadata(data.organization.metadata);

    if (!parsed.success) {
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: 'Business metadata became invalid after organization creation',
      });
    }

    const metadata = parsed.data;

    await getDb()
      .insert(businesses)
      .values({
        id: randomUUID(),
        organizationId: data.organization.id,
        sector: metadata.sector,
        legalName: metadata.legalName ?? data.organization.name,
        panNumber: metadata.panNumber ?? null,
        vatRegistered: metadata.vatRegistered ?? false,
        cbmsRequired: false,
        fiscalYearStartMonth:
          metadata.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH,
        status: 'active',
      });
  },
};

export async function resolveMembershipLimit(
  organizationId: string,
): Promise<number> {
  const [row] = await getDb()
    .select({ featureFlags: plans.featureFlags })
    .from(businesses)
    .innerJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(
      and(
        eq(businesses.organizationId, organizationId),
        eq(subscriptions.status, 'active'),
      ),
    )
    .limit(1);

  const maxStaff = row?.featureFlags?.maxStaff;

  return typeof maxStaff === 'number' && maxStaff > 0
    ? maxStaff
    : DEFAULT_MEMBERSHIP_LIMIT;
}
