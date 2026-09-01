import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, InvoiceLease } from '../../database/schema';
import { fiscalYearLabel } from '../invoices/fiscal-year';

const LEASE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvoiceLeasesService {
  constructor(
    private readonly logger: PinoLogger,
    @InjectDatabase() private readonly db: Database,
  ) {
    this.logger.setContext(InvoiceLeasesService.name);
  }

  async createLease(
    business: Business,
    deviceId: string,
    size: number,
  ): Promise<InvoiceLease> {
    const fiscalYear = fiscalYearLabel(
      new Date(),
      business.fiscalYearStartMonth,
    );

    return this.db.transaction(async (tx) => {
      const [counter] = await tx
        .insert(schema.invoiceCounters)
        .values({ businessId: business.id, fiscalYear, lastNumber: size })
        .onConflictDoUpdate({
          target: [
            schema.invoiceCounters.businessId,
            schema.invoiceCounters.fiscalYear,
          ],
          set: {
            lastNumber: sql`${schema.invoiceCounters.lastNumber} + ${size}`,
          },
        })
        .returning({ lastNumber: schema.invoiceCounters.lastNumber });

      const lastNumber = counter.lastNumber;
      const firstNumber = lastNumber - size + 1;

      const [lease] = await tx
        .insert(schema.invoiceLeases)
        .values({
          id: randomUUID(),
          businessId: business.id,
          fiscalYear,
          deviceId,
          firstNumber,
          lastNumber,
          status: 'open',
          expiresAt: new Date(Date.now() + LEASE_TTL_MS),
        })
        .returning();

      return lease;
    });
  }

  async listOpen(businessId: string): Promise<InvoiceLease[]> {
    return this.db
      .select()
      .from(schema.invoiceLeases)
      .where(
        and(
          eq(schema.invoiceLeases.businessId, businessId),
          eq(schema.invoiceLeases.status, 'open'),
        ),
      );
  }

  async reconcile(
    business: Business,
    leaseId: string,
    usedNumbers: number[],
    actorUserId: string | null,
  ): Promise<{ lease: InvoiceLease; voided: number[] }> {
    const [lease] = await this.db
      .select()
      .from(schema.invoiceLeases)
      .where(
        and(
          eq(schema.invoiceLeases.businessId, business.id),
          eq(schema.invoiceLeases.id, leaseId),
        ),
      )
      .limit(1);

    if (!lease) {
      throw new NotFoundException(`Lease ${leaseId} not found`);
    }

    if (lease.status !== 'open') {
      throw new BadRequestException(
        `Lease ${leaseId} is already ${lease.status}`,
      );
    }

    for (const number of usedNumbers) {
      if (number < lease.firstNumber || number > lease.lastNumber) {
        throw new BadRequestException(
          `Number ${number} is outside this lease's block (${lease.firstNumber}-${lease.lastNumber})`,
        );
      }
    }

    const persisted = await this.findPersistedNumbers(lease);

    const claimedButMissing = usedNumbers.filter(
      (number) => !persisted.has(number),
    );

    if (claimedButMissing.length > 0) {
      this.logger.warn(
        {
          leaseId: lease.id,
          deviceId: lease.deviceId,
          voided: claimedButMissing,
        },
        'Lease claimed numbers as used with no invoice submitted — voiding them',
      );
    }

    return this.closeLease(
      business,
      lease,
      persisted,
      actorUserId,
      'reconciled',
      claimedButMissing,
    );
  }

  async expireStaleLeases(now: Date = new Date()): Promise<number> {
    const stale = await this.db
      .select()
      .from(schema.invoiceLeases)
      .where(
        and(
          eq(schema.invoiceLeases.status, 'open'),
          lte(schema.invoiceLeases.expiresAt, now),
        ),
      );

    let closed = 0;

    for (const lease of stale) {
      const [business] = await this.db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, lease.businessId))
        .limit(1);

      if (!business) {
        continue;
      }

      await this.closeLease(
        business,
        lease,
        await this.findPersistedNumbers(lease),
        null,
        'expired',
        [],
      );

      closed += 1;
    }

    if (closed > 0) {
      this.logger.warn({ closed }, 'Expired and voided stale invoice leases');
    }

    return closed;
  }

  private async findPersistedNumbers(
    lease: InvoiceLease,
  ): Promise<Set<number>> {
    const rows = await this.db
      .select({ invoiceNumber: schema.businessInvoices.invoiceNumber })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, lease.businessId),
          eq(schema.businessInvoices.fiscalYear, lease.fiscalYear),
          gte(schema.businessInvoices.invoiceNumber, lease.firstNumber),
          lte(schema.businessInvoices.invoiceNumber, lease.lastNumber),
        ),
      );

    return new Set(rows.map((row) => row.invoiceNumber));
  }

  private async closeLease(
    business: Business,
    lease: InvoiceLease,
    used: Set<number>,
    actorUserId: string | null,
    finalStatus: 'reconciled' | 'expired',
    claimedButMissing: number[],
  ): Promise<{ lease: InvoiceLease; voided: number[] }> {
    const voided: number[] = [];

    for (let n = lease.firstNumber; n <= lease.lastNumber; n += 1) {
      if (!used.has(n)) {
        voided.push(n);
      }
    }

    const updated = await this.db.transaction(async (tx) => {
      for (const invoiceNumber of voided) {
        const invoiceId = randomUUID();

        await tx.insert(schema.businessInvoices).values({
          id: invoiceId,
          businessId: business.id,
          orderId: null,
          invoiceNumber,
          fiscalYear: lease.fiscalYear,
          subtotalCents: 0,
          vatCents: 0,
          totalCents: 0,
          status: 'voided',
          leaseId: lease.id,
          issuedByUserId: actorUserId,
        });

        await tx.insert(schema.invoiceAuditLog).values({
          id: randomUUID(),
          businessId: business.id,
          invoiceId,
          action: 'issued',
          actorUserId,
          metadata: {
            voided: true,
            reason: claimedButMissing.includes(invoiceNumber)
              ? 'Device reported this leased number as used but never submitted the invoice'
              : finalStatus === 'expired'
                ? 'Leased number unused; lease expired'
                : 'Leased number unused at reconciliation',
            leaseId: lease.id,
            deviceId: lease.deviceId,
          },
        });
      }

      const [row] = await tx
        .update(schema.invoiceLeases)
        .set({
          status: finalStatus,
          usedThrough: used.size > 0 ? Math.max(...used) : null,
          reconciledAt: new Date(),
        })
        .where(eq(schema.invoiceLeases.id, lease.id))
        .returning();

      return row;
    });

    return { lease: updated, voided };
  }
}
