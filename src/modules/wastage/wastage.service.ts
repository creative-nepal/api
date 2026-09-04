import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, type SQL, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, WastageRecord } from '../../database/schema';
import { StockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service';
import type { ListWastageQueryDto, RecordWastageDto } from './dto/wastage.dto';

const QUANTITY_SCALE = 3;

interface IngredientDraw {
  productId: string;
  name: string;
  quantity: number;
  costPriceCents: number;
}

export interface WastageByReason {
  reason: string;
  entries: number;
  costCents: number;
}

export interface WastageByItem {
  itemName: string;
  quantity: number;
  costCents: number;
}

export interface WastageReport {
  totalCostCents: number;
  entries: number;
  byReason: WastageByReason[];
  topItems: WastageByItem[];
}

@Injectable()
export class WastageService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly stockAdjustments: StockAdjustmentsService,
  ) {}

  async list(
    businessId: string,
    query: ListWastageQueryDto,
  ): Promise<PaginatedResult<WastageRecord>> {
    const where = this.buildWhere(businessId, query);

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.wastageRecords)
        .where(where)
        .orderBy(desc(schema.wastageRecords.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.wastageRecords)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async record(
    business: Business,
    branchId: string,
    dto: RecordWastageDto,
    actorUserId: string,
  ): Promise<WastageRecord> {
    if (Boolean(dto.productId) === Boolean(dto.menuItemId)) {
      throw new BadRequestException('i18n:errors.wastage.oneTarget');
    }

    const draws = dto.menuItemId
      ? await this.ingredientsForMenuItem(
          business,
          dto.menuItemId,
          dto.quantity,
        )
      : await this.singleProduct(
          business.id,
          dto.productId as string,
          dto.quantity,
        );

    const itemName = dto.menuItemId
      ? await this.menuItemName(business.id, dto.menuItemId)
      : draws[0].name;

    const costCents = draws.reduce(
      (total, draw) => total + Math.round(draw.costPriceCents * draw.quantity),
      0,
    );

    for (const draw of draws) {
      await this.stockAdjustments.create(
        business,
        branchId,
        {
          productId: draw.productId,
          batchId: dto.batchId,
          delta: -draw.quantity,
          reason: 'wastage',
          note: `${dto.reason}${dto.note ? `: ${dto.note}` : ''}`,
        },
        actorUserId,
      );
    }

    const [row] = await this.db
      .insert(schema.wastageRecords)
      .values({
        id: randomUUID(),
        businessId: business.id,
        branchId,
        productId: dto.productId ?? null,
        menuItemId: dto.menuItemId ?? null,
        batchId: dto.batchId ?? null,
        itemName,
        quantity: dto.quantity.toFixed(QUANTITY_SCALE),
        reason: dto.reason,
        costCents,
        note: dto.note ?? null,
        actorUserId,
      })
      .returning();

    return row;
  }

  async report(businessId: string, sinceDays: number): Promise<WastageReport> {
    const since = new Date(Date.now() - sinceDays * 86_400_000);

    const where = and(
      eq(schema.wastageRecords.businessId, businessId),
      gte(schema.wastageRecords.createdAt, since),
    );

    const [byReason, topItems, [totals]] = await Promise.all([
      this.db
        .select({
          reason: schema.wastageRecords.reason,
          entries: count(),
          costCents: sql<string>`coalesce(sum(${schema.wastageRecords.costCents}), 0)`,
        })
        .from(schema.wastageRecords)
        .where(where)
        .groupBy(schema.wastageRecords.reason),
      this.db
        .select({
          itemName: schema.wastageRecords.itemName,
          quantity: sql<string>`coalesce(sum(${schema.wastageRecords.quantity}), 0)`,
          costCents: sql<string>`coalesce(sum(${schema.wastageRecords.costCents}), 0)`,
        })
        .from(schema.wastageRecords)
        .where(where)
        .groupBy(schema.wastageRecords.itemName)
        .orderBy(sql`sum(${schema.wastageRecords.costCents}) desc`)
        .limit(10),
      this.db
        .select({
          entries: count(),
          costCents: sql<string>`coalesce(sum(${schema.wastageRecords.costCents}), 0)`,
        })
        .from(schema.wastageRecords)
        .where(where),
    ]);

    return {
      totalCostCents: Number(totals?.costCents ?? 0),
      entries: totals?.entries ?? 0,
      byReason: byReason.map((row) => ({
        reason: row.reason,
        entries: row.entries,
        costCents: Number(row.costCents),
      })),
      topItems: topItems.map((row) => ({
        itemName: row.itemName,
        quantity: Number(row.quantity),
        costCents: Number(row.costCents),
      })),
    };
  }

  private async singleProduct(
    businessId: string,
    productId: string,
    quantity: number,
  ): Promise<IngredientDraw[]> {
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
        ),
      )
      .limit(1);

    if (!product) {
      throw new NotFoundException({
        message: 'i18n:errors.product.notFound',
        productId,
      });
    }

    return [
      {
        productId: product.id,
        name: product.name,
        quantity,
        costPriceCents: product.costPriceCents,
      },
    ];
  }

  private async ingredientsForMenuItem(
    business: Business,
    menuItemId: string,
    servings: number,
  ): Promise<IngredientDraw[]> {
    if (business.sector !== 'restaurant') {
      throw new BadRequestException('i18n:errors.wastage.menuItemNotAllowed');
    }

    const rows = await this.db
      .select({
        productId: schema.menuItemIngredients.productId,
        name: schema.products.name,
        perServing: schema.menuItemIngredients.quantity,
        costPriceCents: schema.products.costPriceCents,
      })
      .from(schema.menuItemIngredients)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.menuItemIngredients.productId),
      )
      .where(
        and(
          eq(schema.menuItemIngredients.businessId, business.id),
          eq(schema.menuItemIngredients.menuItemId, menuItemId),
        ),
      );

    if (rows.length === 0) {
      throw new BadRequestException({
        message: 'i18n:errors.wastage.noRecipe',
        menuItemId,
      });
    }

    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      quantity: Number(row.perServing) * servings,
      costPriceCents: row.costPriceCents,
    }));
  }

  private async menuItemName(
    businessId: string,
    menuItemId: string,
  ): Promise<string> {
    const [row] = await this.db
      .select({ name: schema.menuItems.name })
      .from(schema.menuItems)
      .where(
        and(
          eq(schema.menuItems.businessId, businessId),
          eq(schema.menuItems.id, menuItemId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.wastage.menuItemNotFound',
        menuItemId,
      });
    }

    return row.name;
  }

  private buildWhere(
    businessId: string,
    query: ListWastageQueryDto,
  ): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.wastageRecords.businessId, businessId),
    ];

    if (query.reason) {
      conditions.push(eq(schema.wastageRecords.reason, query.reason));
    }

    if (query.productId) {
      conditions.push(eq(schema.wastageRecords.productId, query.productId));
    }

    return and(...conditions);
  }
}
