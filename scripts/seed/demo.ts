import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { auth } from '../../src/auth/auth.config';
import { parseEnabledSectorKeys } from '../../src/sectors/catalog';
import { getDb } from '../../src/database/client';
import { member, organization, user } from '../../src/database/schema/auth';
import {
  businesses,
  plans,
  products,
  subscriptions,
} from '../../src/database/schema/billing';
import { serviceItems } from '../../src/database/schema/services';
import type { SectorKey } from '../../src/database/schema/sector-keys';

interface DemoProduct {
  name: string;
  sku: string;
  priceCents: number;
  costPriceCents: number;
  stockQty: string;
  unitType?: string;
  unitsPerPack?: number;
  subUnitLabel?: string;
  sectorData?: Record<string, unknown>;
}

const DEMO_PRODUCTS: Record<SectorKey, DemoProduct[]> = {
  mart: [
    {
      name: 'Basmati Rice 5kg',
      sku: 'RICE-5',
      priceCents: 129_000,
      costPriceCents: 104_000,
      stockQty: '40',
    },
    {
      name: 'Sunflower Oil 1L',
      sku: 'OIL-1',
      priceCents: 32_500,
      costPriceCents: 26_000,
      stockQty: '85',
    },
    {
      name: 'Wai Wai Noodles',
      sku: 'WW-1',
      priceCents: 2_500,
      costPriceCents: 1_900,
      stockQty: '400',
    },
  ],
  medical: [
    {
      name: 'Paracetamol 500mg (10 tabs)',
      sku: 'PARA-500',
      priceCents: 2_000,
      costPriceCents: 1_300,
      stockQty: '2500',
      unitType: 'strip',
      unitsPerPack: 10,
      subUnitLabel: 'tab',
      sectorData: {
        genericName: 'Paracetamol 500mg',
        manufacturer: 'Deurali-Janta',
        schedule: 'otc',
      },
    },
    {
      name: 'Cetamol 500mg (10 tabs)',
      sku: 'CETA-500',
      priceCents: 1_800,
      costPriceCents: 1_150,
      stockQty: '1800',
      unitType: 'strip',
      unitsPerPack: 10,
      subUnitLabel: 'tab',
      sectorData: {
        genericName: 'Paracetamol 500mg',
        manufacturer: 'Nepal Pharmaceuticals',
        schedule: 'otc',
      },
    },
    {
      name: 'Amoxicillin 250mg (10 caps)',
      sku: 'AMOX-250',
      priceCents: 12_000,
      costPriceCents: 8_500,
      stockQty: '1200',
      unitType: 'strip',
      unitsPerPack: 10,
      subUnitLabel: 'cap',
      sectorData: {
        genericName: 'Amoxicillin 250mg',
        manufacturer: 'Lomus Pharmaceuticals',
        schedule: 'prescription',
      },
    },
    {
      name: 'ORS Sachet',
      sku: 'ORS-1',
      priceCents: 1_500,
      costPriceCents: 900,
      stockQty: '300',
    },
  ],
  services: [
    {
      name: 'General Consultation',
      sku: 'CONSULT',
      priceCents: 80_000,
      costPriceCents: 0,
      stockQty: '0',
    },
    {
      name: 'Physiotherapy Session',
      sku: 'PHYSIO',
      priceCents: 150_000,
      costPriceCents: 0,
      stockQty: '0',
    },
    {
      name: 'Annual Health Check',
      sku: 'CHECKUP',
      priceCents: 450_000,
      costPriceCents: 0,
      stockQty: '0',
    },
  ],
  restaurant: [
    {
      name: 'Chicken Momo (10 pcs)',
      sku: 'MOMO-C',
      priceCents: 22_000,
      costPriceCents: 11_000,
      stockQty: '0',
    },
    {
      name: 'Veg Thali',
      sku: 'THALI-V',
      priceCents: 35_000,
      costPriceCents: 18_000,
      stockQty: '0',
    },
    {
      name: 'Masala Tea',
      sku: 'TEA-M',
      priceCents: 6_000,
      costPriceCents: 2_000,
      stockQty: '0',
    },
  ],
};

const DEMO_LEGAL_NAME: Record<SectorKey, string> = {
  mart: 'Demo Mart Pvt. Ltd.',
  medical: 'Demo Pharmacy Pvt. Ltd.',
  restaurant: 'Demo Restaurant Pvt. Ltd.',
  services: 'Demo Services Pvt. Ltd.',
};

async function ensureOwner(email: string, password: string, name: string) {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const created = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  return created.user.id;
}

async function seedSector(sector: SectorKey, ownerUserId: string) {
  const db = getDb();
  const slug = `demo-${sector}`;

  const [existingOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (existingOrg) {
    console.log(`Demo ${sector}: already present, skipping`);
    return;
  }

  const organizationId = randomUUID();
  const businessId = randomUUID();

  await db.insert(organization).values({
    id: organizationId,
    name: DEMO_LEGAL_NAME[sector],
    slug,
    createdAt: new Date(),
  });

  await db.insert(member).values({
    id: randomUUID(),
    organizationId,
    userId: ownerUserId,
    role: 'owner',
    createdAt: new Date(),
  });

  await db.insert(businesses).values({
    id: businessId,
    organizationId,
    sector,
    legalName: DEMO_LEGAL_NAME[sector],
    panNumber: '300000001',
    vatRegistered: true,
    cbmsRequired: false,
    status: 'active',
  });

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.sector, sector), eq(plans.isActive, true)))
    .limit(1);

  if (plan) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.insert(subscriptions).values({
      id: randomUUID(),
      businessId,
      planId: plan.id,
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  } else {
    console.warn(
      `Demo ${sector}: no active plan found — run db:seed:plans first for a usable demo`,
    );
  }

  const catalog = DEMO_PRODUCTS[sector];

  if (sector === 'services') {
    await db.insert(serviceItems).values(
      catalog.map((entry) => ({
        id: randomUUID(),
        businessId,
        name: entry.name,
        code: entry.sku,
        priceCents: entry.priceCents,
        durationMinutes: 30,
        isVatable: true,
        isActive: true,
      })),
    );
  } else {
    await db.insert(products).values(
      catalog.map((product) => ({
        id: randomUUID(),
        businessId,
        name: product.name,
        sku: product.sku,
        unitType: product.unitType ?? 'pcs',
        unitsPerPack: product.unitsPerPack ?? 1,
        subUnitLabel: product.subUnitLabel ?? null,
        priceCents: product.priceCents,
        costPriceCents: product.costPriceCents,
        stockQty: product.stockQty,
        sectorData: product.sectorData ?? {},
        isActive: true,
      })),
    );
  }

  console.log(
    `Demo ${sector}: business ${businessId} with ${catalog.length} catalog entries`,
  );
}

async function seedDemo() {
  const email = process.env.SEED_DEMO_EMAIL ?? 'demo@example.com';
  const password = process.env.SEED_DEMO_PASSWORD;

  if (!password) {
    throw new Error(
      'SEED_DEMO_PASSWORD must be set (SEED_DEMO_EMAIL defaults to demo@example.com)',
    );
  }

  const ownerUserId = await ensureOwner(email, password, 'Demo Owner');
  const sectors = parseEnabledSectorKeys(process.env.SECTORS_ENABLED);

  console.log(`Seeding demo businesses for: ${sectors.join(', ')}`);

  for (const sector of sectors) {
    await seedSector(sector, ownerUserId);
  }

  console.log(`Demo owner: ${email}`);
}

seedDemo()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
