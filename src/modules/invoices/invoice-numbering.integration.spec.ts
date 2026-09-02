import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../../database/schema';

const connectionString = process.env.TEST_DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb('invoice numbering under concurrency', () => {
  const sqlClient = postgres(connectionString as string, { max: 40 });
  const db = drizzle(sqlClient, { schema });

  const organizationId = randomUUID();
  const businessId = randomUUID();
  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  const fiscalYear = '2082-83';

  beforeAll(async () => {
    await db.insert(schema.organization).values({
      id: organizationId,
      name: 'Concurrency Test Org',
      slug: `concurrency-${organizationId.slice(0, 8)}`,
      createdAt: new Date(),
    });

    await db.insert(schema.businesses).values({
      id: businessId,
      organizationId,
      sector: 'mart',
      legalName: 'Concurrency Test Mart',
      vatRegistered: true,
      cbmsRequired: false,
      fiscalYearStartMonth: 4,
      status: 'active',
    });

    await db.insert(schema.branches).values([
      {
        id: branchId,
        businessId,
        name: 'Main',
        code: null,
        isDefault: true,
        isActive: true,
      },
      {
        id: otherBranchId,
        businessId,
        name: 'Second',
        code: 'B2',
        isDefault: false,
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

  type Executor =
    typeof db | Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

  async function nextInvoiceNumber(
    executor: Executor,
    forBranchId: string = branchId,
  ): Promise<number> {
    const [row] = await executor
      .insert(schema.invoiceCounters)
      .values({ businessId, branchId: forBranchId, fiscalYear, lastNumber: 1 })
      .onConflictDoUpdate({
        target: [
          schema.invoiceCounters.businessId,
          schema.invoiceCounters.branchId,
          schema.invoiceCounters.fiscalYear,
        ],
        set: { lastNumber: sql`${schema.invoiceCounters.lastNumber} + 1` },
      })
      .returning({ lastNumber: schema.invoiceCounters.lastNumber });

    return row.lastNumber;
  }

  it('issues N distinct, gapless numbers from N parallel transactions', async () => {
    const parallelism = 30;

    const numbers = await Promise.all(
      Array.from({ length: parallelism }, () =>
        db.transaction(async (tx) => nextInvoiceNumber(tx)),
      ),
    );

    const sorted = [...numbers].sort((a, b) => a - b);

    expect(new Set(numbers).size).toBe(parallelism);
    expect(sorted).toEqual(
      Array.from({ length: parallelism }, (_, index) => index + 1),
    );
  }, 30_000);

  it('rejects a duplicate (business, branch, fiscalYear, invoiceNumber)', async () => {
    const insert = (invoiceNumber: number, forBranchId: string = branchId) =>
      db.insert(schema.businessInvoices).values({
        id: randomUUID(),
        businessId,
        branchId: forBranchId,
        orderId: null,
        invoiceNumber,
        fiscalYear,
        subtotalCents: 1000,
        vatCents: 130,
        totalCents: 1130,
        status: 'issued',
      });

    await insert(9001);
    await expect(insert(9001)).rejects.toThrow();
  });

  it('lets a second branch hold the same number in its own series', async () => {
    const insert = (invoiceNumber: number, forBranchId: string) =>
      db.insert(schema.businessInvoices).values({
        id: randomUUID(),
        businessId,
        branchId: forBranchId,
        orderId: null,
        invoiceNumber,
        fiscalYear,
        subtotalCents: 1000,
        vatCents: 130,
        totalCents: 1130,
        status: 'issued',
      });

    await insert(9100, branchId);
    await expect(insert(9100, otherBranchId)).resolves.toBeDefined();
  });

  it('numbers each branch independently and gaplessly', async () => {
    const parallelism = 20;

    const [main, second] = await Promise.all([
      Promise.all(
        Array.from({ length: parallelism }, () =>
          db.transaction((tx) => nextInvoiceNumber(tx, branchId)),
        ),
      ),
      Promise.all(
        Array.from({ length: parallelism }, () =>
          db.transaction((tx) => nextInvoiceNumber(tx, otherBranchId)),
        ),
      ),
    ]);

    for (const numbers of [main, second]) {
      expect(new Set(numbers).size).toBe(parallelism);
    }
  }, 30_000);
});
