import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../../../database';

const QUANTITY_SCALE = 3;

export interface RecipeLine {
  productId: string;
  productName: string;
  quantity: string;
  unitType: string;
}

export interface SetRecipeLine {
  productId: string;
  quantity: number;
}

@Injectable()
export class RecipesService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async get(businessId: string, menuItemId: string): Promise<RecipeLine[]> {
    return this.db
      .select({
        productId: schema.menuItemIngredients.productId,
        productName: schema.products.name,
        quantity: schema.menuItemIngredients.quantity,
        unitType: schema.products.unitType,
      })
      .from(schema.menuItemIngredients)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.menuItemIngredients.productId),
      )
      .where(
        and(
          eq(schema.menuItemIngredients.businessId, businessId),
          eq(schema.menuItemIngredients.menuItemId, menuItemId),
        ),
      );
  }

  async set(
    businessId: string,
    menuItemId: string,
    lines: SetRecipeLine[],
  ): Promise<RecipeLine[]> {
    const [menuItem] = await this.db
      .select()
      .from(schema.menuItems)
      .where(
        and(
          eq(schema.menuItems.businessId, businessId),
          eq(schema.menuItems.id, menuItemId),
        ),
      )
      .limit(1);

    if (!menuItem) {
      throw new NotFoundException({
        message: 'i18n:errors.recipe.menuItemNotFound',
        menuItemId,
      });
    }

    const seen = new Set<string>();

    for (const line of lines) {
      if (seen.has(line.productId)) {
        throw new BadRequestException({
          message: 'i18n:errors.recipe.duplicateIngredient',
          productId: line.productId,
        });
      }
      seen.add(line.productId);
    }

    const products = lines.length
      ? await this.db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.businessId, businessId))
      : [];

    const known = new Set(products.map((product) => product.id));

    for (const line of lines) {
      if (!known.has(line.productId)) {
        throw new NotFoundException({
          message: 'i18n:errors.recipe.productNotFound',
          productId: line.productId,
        });
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.menuItemIngredients)
        .where(
          and(
            eq(schema.menuItemIngredients.businessId, businessId),
            eq(schema.menuItemIngredients.menuItemId, menuItemId),
          ),
        );

      if (lines.length > 0) {
        await tx.insert(schema.menuItemIngredients).values(
          lines.map((line) => ({
            id: randomUUID(),
            businessId,
            menuItemId,
            productId: line.productId,
            quantity: line.quantity.toFixed(QUANTITY_SCALE),
          })),
        );
      }
    });

    return this.get(businessId, menuItemId);
  }

  /**
   * Consumes the ingredients for every reciped line on an order.
   *
   * Stock is allowed to go negative: the kitchen has already been told to
   * cook, and refusing here would strand a placed order mid-service. An item
   * that genuinely cannot be made should be marked unavailable on the menu.
   * The shortfall is reported so the caller can raise it.
   */
  async depleteForOrder(
    executor: DatabaseExecutor,
    businessId: string,
    branchId: string,
    orderId: string,
    actorUserId: string | null,
  ): Promise<{ depleted: number; shortfalls: string[] }> {
    const required = await executor
      .select({
        productId: schema.menuItemIngredients.productId,
        productName: schema.products.name,
        perItem: schema.menuItemIngredients.quantity,
        orderedQty: schema.orderItems.quantity,
      })
      .from(schema.orderItems)
      .innerJoin(
        schema.menuItemIngredients,
        eq(schema.menuItemIngredients.menuItemId, schema.orderItems.menuItemId),
      )
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.menuItemIngredients.productId),
      )
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          eq(schema.orderItems.orderId, orderId),
        ),
      );

    const totals = new Map<string, { name: string; qty: number }>();

    for (const row of required) {
      const amount = Number(row.perItem) * Number(row.orderedQty);
      const current = totals.get(row.productId);

      totals.set(row.productId, {
        name: row.productName,
        qty: (current?.qty ?? 0) + amount,
      });
    }

    const shortfalls: string[] = [];

    for (const [productId, { name, qty }] of totals) {
      const amount = qty.toFixed(QUANTITY_SCALE);

      const [branchRow] = await executor
        .update(schema.productBranchStock)
        .set({
          stockQty: sql`${schema.productBranchStock.stockQty} - ${amount}::numeric`,
        })
        .where(
          and(
            eq(schema.productBranchStock.businessId, businessId),
            eq(schema.productBranchStock.branchId, branchId),
            eq(schema.productBranchStock.productId, productId),
          ),
        )
        .returning();

      if (!branchRow || Number(branchRow.stockQty) < 0) {
        shortfalls.push(name);
      }

      await executor
        .update(schema.products)
        .set({
          stockQty: sql`${schema.products.stockQty} - ${amount}::numeric`,
        })
        .where(
          and(
            eq(schema.products.businessId, businessId),
            eq(schema.products.id, productId),
          ),
        );

      await executor.insert(schema.stockAdjustments).values({
        id: randomUUID(),
        businessId,
        branchId,
        productId,
        batchId: null,
        delta: (-qty).toFixed(QUANTITY_SCALE),
        reason: 'recipe_depletion',
        note: `Order ${orderId}`,
        actorUserId,
      });
    }

    return { depleted: totals.size, shortfalls };
  }
}
