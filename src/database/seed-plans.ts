import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { parseEnabledSectorKeys } from '../sectors/catalog';
import { getDb } from './client';
import { type NewPlan, plans } from './schema/billing';

const SEED_PLANS: Array<Omit<NewPlan, 'id'>> = [
  {
    sector: 'mart',
    key: 'mart-basic',
    name: 'Mart Basic',
    priceCents: 99_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: { maxStaff: 3, maxProducts: 500 },
    isActive: true,
  },
  {
    sector: 'mart',
    key: 'mart-pro',
    name: 'Mart Pro',
    priceCents: 249_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: {
      maxStaff: 15,
      maxProducts: 10_000,
      registerExport: true,
    },
    isActive: true,
  },
  {
    sector: 'medical',
    key: 'medical-basic',
    name: 'Medical Basic',
    priceCents: 149_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: { maxStaff: 5, maxProducts: 2_000, batchTracking: true },
    isActive: true,
  },
  {
    sector: 'medical',
    key: 'medical-pro',
    name: 'Medical Pro',
    priceCents: 299_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: {
      maxStaff: 20,
      maxProducts: 20_000,
      batchTracking: true,
      registerExport: true,
    },
    isActive: true,
  },
  {
    sector: 'services',
    key: 'services-basic',
    name: 'Services Basic',
    priceCents: 129_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: {
      maxStaff: 5,
      maxProducts: 200,
      maxAppointmentsPerMonth: 400,
    },
    isActive: true,
  },
  {
    sector: 'services',
    key: 'services-pro',
    name: 'Services Pro',
    priceCents: 299_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: {
      maxStaff: 25,
      maxProducts: 2_000,
      maxAppointmentsPerMonth: 5_000,
      registerExport: true,
    },
    isActive: true,
  },
  {
    sector: 'restaurant',
    key: 'restaurant-basic',
    name: 'Restaurant Basic',
    priceCents: 149_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: { maxStaff: 8, maxProducts: 500 },
    isActive: true,
  },
  {
    sector: 'restaurant',
    key: 'restaurant-pro',
    name: 'Restaurant Pro',
    priceCents: 349_900,
    currency: 'NPR',
    billingCycle: 'monthly',
    featureFlags: {
      maxStaff: 30,
      maxProducts: 5_000,
      registerExport: true,
    },
    isActive: true,
  },
];

async function seedPlans() {
  const db = getDb();
  const enabled = new Set<string>(
    parseEnabledSectorKeys(process.env.SECTORS_ENABLED),
  );

  const wanted = SEED_PLANS.filter((plan) => enabled.has(plan.sector));

  console.log(
    `Seeding plans for sector(s): ${[...enabled].join(', ')} (${wanted.length} plans)`,
  );

  for (const plan of wanted) {
    const [existing] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.sector, plan.sector), eq(plans.key, plan.key)))
      .limit(1);

    if (existing) {
      await db
        .update(plans)
        .set({
          name: plan.name,
          priceCents: plan.priceCents,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          featureFlags: plan.featureFlags,
          isActive: plan.isActive,
        })
        .where(eq(plans.id, existing.id));
      console.log(`Plan updated: ${plan.sector}/${plan.key}`);
      continue;
    }

    await db.insert(plans).values({ id: randomUUID(), ...plan });
    console.log(`Plan created: ${plan.sector}/${plan.key}`);
  }
}

seedPlans()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
