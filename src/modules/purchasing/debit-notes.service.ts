import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  Business,
  DebitNote,
  DebitNoteItem,
  PurchaseBill,
} from '../../database/schema';
import { fiscalYearLabel } from '../invoices/fiscal-year';
import type {
  CreateDebitNoteDto,
  ListDebitNotesFilters,
} from './dto/purchasing.dto';

const QUANTITY_SCALE = 3;

export interface DebitNoteWithItems extends DebitNote {
  items: DebitNoteItem[];
}

@Injectable()
export class DebitNotesService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async list(
    businessId: string,
    filters: ListDebitNotesFilters,
  ): Promise<PaginatedResult<DebitNote>> {
    const where = and(
      eq(schema.debitNotes.businessId, businessId),
      ...(filters.supplierId
        ? [eq(schema.debitNotes.supplierId, filters.supplierId)]
        : []),
      ...(filters.purchaseBillId
        ? [eq(schema.debitNotes.purchaseBillId, filters.purchaseBillId)]
        : []),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.debitNotes)
        .where(where)
        .orderBy(desc(schema.debitNotes.issuedAt))
        .limit(filters.limit)
        .offset(filters.offset),
      this.db.select({ value: count() }).from(schema.debitNotes).where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async get(businessId: string, noteId: string): Promise<DebitNoteWithItems> {
    const [note] = await this.db
      .select()
      .from(schema.debitNotes)
      .where(
        and(
          eq(schema.debitNotes.businessId, businessId),
          eq(schema.debitNotes.id, noteId),
        ),
      )
      .limit(1);

    if (!note) {
      throw new NotFoundException({
        message: 'i18n:errors.purchase.debitNoteNotFound',
        noteId,
      });
    }

    const items = await this.db
      .select()
      .from(schema.debitNoteItems)
      .where(eq(schema.debitNoteItems.debitNoteId, note.id));

    return { ...note, items };
  }

  async issue(
    business: Business,
    billId: string,
    dto: CreateDebitNoteDto,
    actorUserId: string | null,
  ): Promise<DebitNoteWithItems> {
    const bill = await this.loadBill(business.id, billId);

    const lines = dto.items.map((item) => {
      const quantity = item.quantity ?? 1;
      return {
        ...item,
        quantity,
        vatCents: item.vatCents ?? 0,
        lineTotalCents: Math.round(item.unitPriceCents * quantity),
      };
    });

    const subtotalCents = lines.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    );
    const vatCents = lines.reduce((total, line) => total + line.vatCents, 0);
    const totalCents = subtotalCents + vatCents;

    const alreadyDebited = await this.debitedTotalCents(business.id, bill.id);

    if (alreadyDebited + totalCents > bill.totalCents) {
      throw new BadRequestException({
        message: 'i18n:errors.purchase.debitNoteExceedsBill',
        remaining: bill.totalCents - alreadyDebited,
        requested: totalCents,
      });
    }

    const restock = dto.restock ?? false;

    if (restock) {
      const missingProduct = lines.some((line) => !line.productId);

      if (missingProduct) {
        throw new BadRequestException(
          'i18n:errors.purchase.debitNoteRestockNeedsProduct',
        );
      }
    }

    const issuedAt = new Date();
    const series = fiscalYearLabel(issuedAt, business.fiscalYearStartMonth);

    return this.db.transaction(async (tx) => {
      const [counter] = await tx
        .insert(schema.debitNoteCounters)
        .values({ businessId: business.id, series, lastNumber: 1 })
        .onConflictDoUpdate({
          target: [
            schema.debitNoteCounters.businessId,
            schema.debitNoteCounters.series,
          ],
          set: {
            lastNumber: sql`${schema.debitNoteCounters.lastNumber} + 1`,
          },
        })
        .returning({ lastNumber: schema.debitNoteCounters.lastNumber });

      const [note] = await tx
        .insert(schema.debitNotes)
        .values({
          id: randomUUID(),
          businessId: business.id,
          supplierId: bill.supplierId,
          purchaseBillId: bill.id,
          noteNumber: counter.lastNumber,
          series,
          reason: dto.reason,
          note: dto.note ?? null,
          subtotalCents,
          vatCents,
          totalCents,
          restocked: restock,
          issuedAt,
          createdByUserId: actorUserId,
        })
        .returning();

      const items = await tx
        .insert(schema.debitNoteItems)
        .values(
          lines.map((line) => ({
            id: randomUUID(),
            businessId: business.id,
            debitNoteId: note.id,
            purchaseBillItemId: line.purchaseBillItemId ?? null,
            productId: line.productId ?? null,
            description: line.description,
            quantity: line.quantity.toFixed(QUANTITY_SCALE),
            unitPriceCents: line.unitPriceCents,
            vatCents: line.vatCents,
            lineTotalCents: line.lineTotalCents,
          })),
        )
        .returning();

      if (restock) {
        for (const line of lines) {
          const productId = line.productId as string;
          const delta = -line.quantity;

          await tx
            .update(schema.products)
            .set({
              stockQty: sql`${schema.products.stockQty} - ${line.quantity.toFixed(QUANTITY_SCALE)}`,
            })
            .where(
              and(
                eq(schema.products.businessId, business.id),
                eq(schema.products.id, productId),
              ),
            );

          await tx.insert(schema.stockAdjustments).values({
            id: randomUUID(),
            businessId: business.id,
            productId,
            batchId: null,
            delta: delta.toFixed(QUANTITY_SCALE),
            reason: 'debit_note',
            note: `Debit note ${series}-${counter.lastNumber}`,
            actorUserId,
          });
        }
      }

      return { ...note, items };
    });
  }

  private async loadBill(
    businessId: string,
    billId: string,
  ): Promise<PurchaseBill> {
    const [bill] = await this.db
      .select()
      .from(schema.purchaseBills)
      .where(
        and(
          eq(schema.purchaseBills.businessId, businessId),
          eq(schema.purchaseBills.id, billId),
        ),
      )
      .limit(1);

    if (!bill) {
      throw new NotFoundException({
        message: 'i18n:errors.purchase.billNotFound',
        billId,
      });
    }

    return bill;
  }

  private async debitedTotalCents(
    businessId: string,
    billId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({
        value: sql<number>`coalesce(sum(${schema.debitNotes.totalCents}), 0)::int`,
      })
      .from(schema.debitNotes)
      .where(
        and(
          eq(schema.debitNotes.businessId, businessId),
          eq(schema.debitNotes.purchaseBillId, billId),
        ),
      );

    return row?.value ?? 0;
  }
}
