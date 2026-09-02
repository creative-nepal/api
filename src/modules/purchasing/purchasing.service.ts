import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, ilike, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import type { ListPurchaseFilters } from './dto/purchasing.dto';
import { BASIS_POINTS_DIVISOR } from '../../database/schema';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  Business,
  PurchaseBill,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from '../../database/schema';
import { BatchesRepository } from '../batches/batches.repository';
import type {
  CreatePurchaseBillDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceivePurchaseOrderDto,
} from './dto/purchasing.dto';
import { weightedAverageCostCents } from './weighted-average';

const QUANTITY_SCALE = 3;

@Injectable()
export class PurchasingService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly batchesRepository: BatchesRepository,
  ) {}

  async listSuppliers(
    businessId: string,
    filters: ListPurchaseFilters,
  ): Promise<PaginatedResult<Supplier>> {
    const where = and(
      eq(schema.suppliers.businessId, businessId),
      ...(filters.search
        ? [ilike(schema.suppliers.name, `%${filters.search}%`)]
        : []),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.suppliers)
        .where(where)
        .orderBy(
          resolveOrderBy(
            {
              name: schema.suppliers.name,
              createdAt: schema.suppliers.createdAt,
            },
            filters.sortBy,
            filters.sortDirection,
            schema.suppliers.name,
          ),
        )
        .limit(filters.limit)
        .offset(filters.offset),
      this.db.select({ value: count() }).from(schema.suppliers).where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async createSupplier(
    businessId: string,
    dto: CreateSupplierDto,
  ): Promise<Supplier> {
    const [row] = await this.db
      .insert(schema.suppliers)
      .values({
        id: randomUUID(),
        businessId,
        name: dto.name,
        panNumber: dto.panNumber ?? null,
        address: dto.address ?? null,
        contact: dto.contact ?? null,
      })
      .returning();
    return row;
  }

  async listPurchaseOrders(
    businessId: string,
    filters: ListPurchaseFilters,
  ): Promise<PaginatedResult<PurchaseOrder>> {
    const where = and(
      eq(schema.purchaseOrders.businessId, businessId),
      ...(filters.status
        ? [eq(schema.purchaseOrders.status, filters.status)]
        : []),
      ...(filters.supplierId
        ? [eq(schema.purchaseOrders.supplierId, filters.supplierId)]
        : []),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.purchaseOrders)
        .where(where)
        .orderBy(
          resolveOrderBy(
            {
              status: schema.purchaseOrders.status,
              createdAt: schema.purchaseOrders.createdAt,
              expectedAt: schema.purchaseOrders.expectedAt,
            },
            filters.sortBy,
            filters.sortDirection,
            schema.purchaseOrders.createdAt,
          ),
        )
        .limit(filters.limit)
        .offset(filters.offset),
      this.db
        .select({ value: count() })
        .from(schema.purchaseOrders)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async getPurchaseOrder(
    businessId: string,
    id: string,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    const [order] = await this.db
      .select()
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.businessId, businessId),
          eq(schema.purchaseOrders.id, id),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    const items = await this.db
      .select()
      .from(schema.purchaseOrderItems)
      .where(
        and(
          eq(schema.purchaseOrderItems.businessId, businessId),
          eq(schema.purchaseOrderItems.purchaseOrderId, id),
        ),
      );

    return { order, items };
  }

  async createPurchaseOrder(
    business: Business,
    dto: CreatePurchaseOrderDto,
    actorUserId: string,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    const [supplier] = await this.db
      .select()
      .from(schema.suppliers)
      .where(
        and(
          eq(schema.suppliers.businessId, business.id),
          eq(schema.suppliers.id, dto.supplierId),
        ),
      )
      .limit(1);

    if (!supplier) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }

    if (business.sector === 'medical') {
      for (const item of dto.items) {
        if (!item.batchNo || !item.expiryDate) {
          throw new BadRequestException(
            'Medical purchase lines need a batchNo and expiryDate',
          );
        }
      }
    }

    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(schema.purchaseOrders)
        .values({
          id: randomUUID(),
          businessId: business.id,
          supplierId: dto.supplierId,
          reference: dto.reference ?? null,
          status: 'pending',
          expectedAt: dto.expectedAt ?? null,
          createdByUserId: actorUserId,
        })
        .returning();

      const items = await tx
        .insert(schema.purchaseOrderItems)
        .values(
          dto.items.map((item) => ({
            id: randomUUID(),
            businessId: business.id,
            purchaseOrderId: order.id,
            productId: item.productId,
            orderedQty: item.orderedQty.toFixed(QUANTITY_SCALE),
            receivedQty: '0',
            purchasePriceCents: item.purchasePriceCents,
            lineTotalCents: Math.round(
              item.purchasePriceCents * item.orderedQty,
            ),
            batchNo: item.batchNo ?? null,
            expiryDate: item.expiryDate ?? null,
          })),
        )
        .returning();

      return { order, items };
    });
  }

  async confirmPurchaseOrder(
    businessId: string,
    id: string,
  ): Promise<PurchaseOrder> {
    const { order } = await this.getPurchaseOrder(businessId, id);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Purchase order ${id} is ${order.status}; only a pending order can be confirmed`,
      );
    }

    const [row] = await this.db
      .update(schema.purchaseOrders)
      .set({ status: 'confirmed' })
      .where(eq(schema.purchaseOrders.id, id))
      .returning();
    return row;
  }

  async receive(
    business: Business,
    branchId: string,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
    actorUserId: string,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    const { order, items } = await this.getPurchaseOrder(
      business.id,
      purchaseOrderId,
    );

    if (order.status === 'canceled' || order.status === 'received') {
      throw new BadRequestException(
        `Purchase order ${purchaseOrderId} is ${order.status}`,
      );
    }

    const byId = new Map(items.map((item) => [item.id, item]));

    for (const line of dto.lines) {
      const item = byId.get(line.purchaseOrderItemId);

      if (!item) {
        throw new NotFoundException(
          `Line ${line.purchaseOrderItemId} is not on this purchase order`,
        );
      }

      const outstanding = Number(item.orderedQty) - Number(item.receivedQty);

      if (line.receivedQty > outstanding + 1e-9) {
        throw new BadRequestException({
          message: 'i18n:errors.purchase.overReceive',
          quantity: line.receivedQty,
          productId: item.productId,
          outstanding,
        });
      }
    }

    await this.db.transaction(async (tx) => {
      for (const line of dto.lines) {
        if (line.receivedQty <= 0) {
          continue;
        }

        const item = byId.get(line.purchaseOrderItemId) as PurchaseOrderItem;
        const receivedText = line.receivedQty.toFixed(QUANTITY_SCALE);

        const [product] = await tx
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.businessId, business.id),
              eq(schema.products.id, item.productId),
            ),
          )
          .limit(1);

        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }

        const newCostCents = weightedAverageCostCents({
          existingQty: Number(product.stockQty),
          existingCostCents: product.costPriceCents,
          receivedQty: line.receivedQty,
          purchasePriceCents: item.purchasePriceCents,
        });

        let batchId: string | null = null;

        if (business.sector === 'medical') {
          batchId = await this.receiveIntoBatch(
            tx,
            business.id,
            item,
            receivedText,
          );

          await tx
            .update(schema.products)
            .set({ costPriceCents: newCostCents })
            .where(eq(schema.products.id, product.id));

          await this.batchesRepository.syncProductStock(
            tx,
            business.id,
            product.id,
          );
        } else {
          await tx
            .update(schema.products)
            .set({
              stockQty: sql`${schema.products.stockQty} + ${receivedText}::numeric`,
              costPriceCents: newCostCents,
            })
            .where(eq(schema.products.id, product.id));
        }

        await tx
          .insert(schema.productBranchStock)
          .values({
            businessId: business.id,
            branchId,
            productId: product.id,
            stockQty: receivedText,
          })
          .onConflictDoUpdate({
            target: [
              schema.productBranchStock.branchId,
              schema.productBranchStock.productId,
            ],
            set: {
              stockQty: sql`${schema.productBranchStock.stockQty} + ${receivedText}::numeric`,
            },
          });

        await tx
          .update(schema.purchaseOrderItems)
          .set({
            receivedQty: sql`${schema.purchaseOrderItems.receivedQty} + ${receivedText}::numeric`,
          })
          .where(eq(schema.purchaseOrderItems.id, item.id));

        await tx.insert(schema.stockAdjustments).values({
          id: randomUUID(),
          businessId: business.id,
          branchId,
          productId: product.id,
          batchId,
          delta: receivedText,
          reason: 'stock_in',
          note: `Goods receipt against purchase order ${purchaseOrderId}`,
          actorUserId,
        });
      }

      const refreshed = await tx
        .select()
        .from(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.purchaseOrderId, purchaseOrderId));

      const fullyReceived = refreshed.every(
        (item) => Number(item.receivedQty) >= Number(item.orderedQty) - 1e-9,
      );

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: fullyReceived ? 'received' : 'partially_received',
          receivedAt: fullyReceived ? new Date() : null,
        })
        .where(eq(schema.purchaseOrders.id, purchaseOrderId));
    });

    return this.getPurchaseOrder(business.id, purchaseOrderId);
  }

  private async receiveIntoBatch(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    businessId: string,
    item: PurchaseOrderItem,
    receivedText: string,
  ): Promise<string> {
    const [existing] = await tx
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.productId, item.productId),
          eq(schema.productBatches.batchNo, item.batchNo as string),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .update(schema.productBatches)
        .set({
          qty: sql`${schema.productBatches.qty} + ${receivedText}::numeric`,
        })
        .where(eq(schema.productBatches.id, existing.id));
      return existing.id;
    }

    const [created] = await tx
      .insert(schema.productBatches)
      .values({
        id: randomUUID(),
        businessId,
        productId: item.productId,
        batchNo: item.batchNo as string,
        expiryDate: item.expiryDate as string,
        qty: receivedText,
        costPriceCents: item.purchasePriceCents,
        isActive: true,
      })
      .returning();

    return created.id;
  }

  async listBills(
    businessId: string,
    filters: ListPurchaseFilters,
  ): Promise<PaginatedResult<PurchaseBill>> {
    const where = and(
      eq(schema.purchaseBills.businessId, businessId),
      ...(filters.status
        ? [eq(schema.purchaseBills.status, filters.status)]
        : []),
      ...(filters.supplierId
        ? [eq(schema.purchaseBills.supplierId, filters.supplierId)]
        : []),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.purchaseBills)
        .where(where)
        .orderBy(
          resolveOrderBy(
            {
              billDate: schema.purchaseBills.billDate,
              dueDate: schema.purchaseBills.dueDate,
              totalCents: schema.purchaseBills.totalCents,
              status: schema.purchaseBills.status,
            },
            filters.sortBy,
            filters.sortDirection,
            schema.purchaseBills.billDate,
          ),
        )
        .limit(filters.limit)
        .offset(filters.offset),
      this.db
        .select({ value: count() })
        .from(schema.purchaseBills)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async createBill(
    businessId: string,
    dto: CreatePurchaseBillDto,
  ): Promise<PurchaseBill> {
    const [duplicate] = await this.db
      .select()
      .from(schema.purchaseBills)
      .where(
        and(
          eq(schema.purchaseBills.businessId, businessId),
          eq(schema.purchaseBills.supplierId, dto.supplierId),
          eq(schema.purchaseBills.billNumber, dto.billNumber),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictException({
        message: 'i18n:errors.purchase.duplicateBill',
        billNumber: dto.billNumber,
      });
    }

    const lines = dto.items.map((item) => {
      const quantity = item.quantity ?? 1;
      const lineTotalCents = Math.round(item.unitPriceCents * quantity);
      return {
        ...item,
        quantity,
        lineTotalCents,
        vatCents: item.vatCents ?? 0,
      };
    });

    const subtotalCents = lines.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    );
    const vatCents = lines.reduce((total, line) => total + line.vatCents, 0);

    const tdsRateBasisPoints = dto.tdsRateBasisPoints ?? 0;
    const tdsAmountCents = Math.round(
      (subtotalCents * tdsRateBasisPoints) / BASIS_POINTS_DIVISOR,
    );

    return this.db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(schema.purchaseBills)
        .values({
          id: randomUUID(),
          businessId,
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          billNumber: dto.billNumber,
          billDate: dto.billDate,
          dueDate: dto.dueDate ?? null,
          subtotalCents,
          vatCents,
          totalCents: subtotalCents + vatCents,
          tdsRateBasisPoints,
          tdsAmountCents,
          paidCents: 0,
          status: 'unpaid',
        })
        .returning();

      await tx.insert(schema.purchaseBillItems).values(
        lines.map((line) => ({
          id: randomUUID(),
          businessId,
          purchaseBillId: bill.id,
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity.toFixed(QUANTITY_SCALE),
          unitPriceCents: line.unitPriceCents,
          vatCents: line.vatCents,
          lineTotalCents: line.lineTotalCents,
        })),
      );

      return bill;
    });
  }

  async recordPayment(
    businessId: string,
    billId: string,
    amountCents: number,
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
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    const paidCents = bill.paidCents + amountCents;

    const payableCents = bill.totalCents - bill.tdsAmountCents;

    if (paidCents > payableCents) {
      throw new BadRequestException({
        message: 'i18n:errors.purchase.overPayment',
        outstanding: payableCents - bill.paidCents,
        tds: bill.tdsAmountCents,
      });
    }

    const [row] = await this.db
      .update(schema.purchaseBills)
      .set({
        paidCents,
        status: paidCents >= payableCents ? 'paid' : 'partially_paid',
      })
      .where(eq(schema.purchaseBills.id, billId))
      .returning();

    return row;
  }
}
