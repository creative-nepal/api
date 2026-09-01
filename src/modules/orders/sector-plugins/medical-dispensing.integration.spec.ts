import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../database/schema';

const connectionString = process.env.TEST_DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb('medical batch dispensing', () => {
  const sqlClient = postgres(connectionString as string, { max: 40 });
  const db = drizzle(sqlClient, { schema });

  const organizationId = randomUUID();
  const businessId = randomUUID();
  const productId = randomUUID();

  const batches = {
    near: randomUUID(),
    mid: randomUUID(),
    far: randomUUID(),
    expired: randomUUID(),
  };

  function futureDate(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    await db.insert(schema.organization).values({
      id: organizationId,
      name: 'FEFO Test Pharmacy',
      slug: `fefo-${organizationId.slice(0, 8)}`,
      createdAt: new Date(),
    });

    await db.insert(schema.businesses).values({
      id: businessId,
      organizationId,
      sector: 'medical',
      legalName: 'FEFO Test Pharmacy',
      vatRegistered: true,
      cbmsRequired: false,
      fiscalYearStartMonth: 4,
      status: 'active',
    });

    await db.insert(schema.products).values({
      id: productId,
      businessId,
      name: 'Test Tablet',
      sku: 'TEST-TAB',
      unitType: 'strip',
      priceCents: 1000,
      stockQty: '0',
      lowStockThreshold: '0',
      isActive: true,
      sectorData: { schedule: 'otc' },
    });

    await db.insert(schema.productBatches).values([
      {
        id: batches.expired,
        businessId,
        productId,
        batchNo: 'EXPIRED',
        expiryDate: '2020-01-01',
        qty: '100',
        costPriceCents: 500,
        isActive: true,
      },
      {
        id: batches.far,
        businessId,
        productId,
        batchNo: 'FAR',
        expiryDate: futureDate(365),
        qty: '5',
        costPriceCents: 500,
        isActive: true,
      },
      {
        id: batches.near,
        businessId,
        productId,
        batchNo: 'NEAR',
        expiryDate: futureDate(30),
        qty: '3',
        costPriceCents: 500,
        isActive: true,
      },
      {
        id: batches.mid,
        businessId,
        productId,
        batchNo: 'MID',
        expiryDate: futureDate(120),
        qty: '4',
        costPriceCents: 500,
        isActive: true,
      },
    ]);
  });

  afterAll(async () => {
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.id, organizationId));
    await sqlClient.end();
  });

  async function dispensable() {
    return db
      .select()
      .from(schema.productBatches)
      .where(
        sql`${schema.productBatches.businessId} = ${businessId}
          AND ${schema.productBatches.productId} = ${productId}
          AND ${schema.productBatches.isActive} = true
          AND ${schema.productBatches.qty} > 0
          AND ${schema.productBatches.expiryDate} > CURRENT_DATE`,
      )
      .orderBy(schema.productBatches.expiryDate);
  }

  async function takeFrom(batchId: string, quantity: string) {
    const [row] = await db
      .update(schema.productBatches)
      .set({ qty: sql`${schema.productBatches.qty} - ${quantity}::numeric` })
      .where(
        sql`${schema.productBatches.businessId} = ${businessId}
          AND ${schema.productBatches.id} = ${batchId}
          AND ${schema.productBatches.isActive} = true
          AND ${schema.productBatches.qty} >= ${quantity}::numeric
          AND ${schema.productBatches.expiryDate} > CURRENT_DATE`,
      )
      .returning();
    return row;
  }

  it('orders candidates nearest-expiry-first and excludes expired stock', async () => {
    const candidates = await dispensable();

    expect(candidates.map((batch) => batch.batchNo)).toEqual([
      'NEAR',
      'MID',
      'FAR',
    ]);
    expect(candidates.some((batch) => batch.batchNo === 'EXPIRED')).toBe(false);
  });

  it('refuses to dispense from an expired batch even when named explicitly', async () => {
    await expect(takeFrom(batches.expired, '1')).resolves.toBeUndefined();

    const [row] = await db
      .select()
      .from(schema.productBatches)
      .where(eq(schema.productBatches.id, batches.expired));

    expect(Number(row.qty)).toBe(100);
  });

  it('does not oversell one batch under concurrent dispensing', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => takeFrom(batches.near, '1')),
    );

    const winners = results.filter(Boolean);
    expect(winners).toHaveLength(3);

    const [row] = await db
      .select()
      .from(schema.productBatches)
      .where(eq(schema.productBatches.id, batches.near));

    expect(Number(row.qty)).toBe(0);
  }, 30_000);

  it('keeps products.stockQty equal to the live batch total', async () => {
    await db
      .update(schema.products)
      .set({
        stockQty: sql`COALESCE((
          SELECT SUM(${schema.productBatches.qty})
          FROM ${schema.productBatches}
          WHERE ${schema.productBatches.businessId} = ${businessId}
            AND ${schema.productBatches.productId} = ${productId}
            AND ${schema.productBatches.isActive} = true
            AND ${schema.productBatches.expiryDate} > CURRENT_DATE
        ), 0)`,
      })
      .where(eq(schema.products.id, productId));

    const [product] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId));

    expect(Number(product.stockQty)).toBe(9);
  });
});
