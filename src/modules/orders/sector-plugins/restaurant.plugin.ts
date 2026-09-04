import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '../../../database';
import type {
  MenuItem,
  SelectedModifier,
  Sector,
} from '../../../database/schema';
import type { CheckoutItemDto, CreateOrderDto } from '../dto/order-request.dto';
import type {
  CheckoutContext,
  CheckoutLine,
  SectorPlugin,
} from './sector-plugin.interface';

@Injectable()
export class RestaurantSectorPlugin implements SectorPlugin {
  readonly sector: Sector = 'restaurant';
  billsOnCreate(dto: CreateOrderDto): boolean {
    return !dto.tableId;
  }

  beforeCreate(): void {}

  async onLineItemAdd(
    context: CheckoutContext,
    item: CheckoutItemDto,
  ): Promise<CheckoutLine[]> {
    if (item.batchId) {
      throw new BadRequestException(
        'batchId is not applicable to the restaurant sector',
      );
    }

    const menuItemId = item.menuItemId ?? item.productId;

    if (!menuItemId) {
      throw new BadRequestException('menuItemId is required');
    }

    const [menuItem] = await context.executor
      .select()
      .from(schema.menuItems)
      .where(
        and(
          eq(schema.menuItems.businessId, context.business.id),
          eq(schema.menuItems.id, menuItemId),
        ),
      )
      .limit(1);

    if (!menuItem) {
      throw new NotFoundException(`Menu item ${menuItemId} not found`);
    }

    if (!menuItem.isAvailable) {
      throw new BadRequestException(
        `${menuItem.name} is currently unavailable`,
      );
    }

    const modifiers = this.resolveModifiers(menuItem, item.modifiers ?? []);
    const modifierDelta = modifiers.reduce(
      (total, modifier) => total + modifier.priceDeltaCents,
      0,
    );
    const unitPriceCents = menuItem.priceCents + modifierDelta;

    return [
      {
        product: null,
        menuItem,
        modifiers,
        note: item.note ?? null,
        quantity: item.quantity,
        unitPriceCents,
        unitCostCents: await this.recipeCostCents(context, menuItem.id),
        lineTotalCents: Math.round(unitPriceCents * item.quantity),
        batchId: null,
      },
    ];
  }

  private async recipeCostCents(
    context: CheckoutContext,
    menuItemId: string,
  ): Promise<number> {
    const [row] = await context.executor
      .select({
        costCents: sql<string>`COALESCE(SUM(
          ${schema.menuItemIngredients.quantity} *
          (${schema.products.costPriceCents}::numeric / GREATEST(${schema.products.unitsPerPack}, 1))
        ), 0)`,
      })
      .from(schema.menuItemIngredients)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.menuItemIngredients.productId),
      )
      .where(eq(schema.menuItemIngredients.menuItemId, menuItemId));

    return Math.round(Number(row?.costCents ?? 0));
  }

  async beforeCheckout(): Promise<void> {}

  async afterCheckout(): Promise<void> {}

  private assertSelectionCounts(
    menuItem: MenuItem,
    selections: Array<{ name: string; label: string }>,
  ): void {
    const chosen = new Map<string, number>();

    for (const selection of selections) {
      chosen.set(selection.name, (chosen.get(selection.name) ?? 0) + 1);
    }

    for (const modifier of menuItem.modifiers) {
      const count = chosen.get(modifier.name) ?? 0;

      if (modifier.required && count === 0) {
        throw new BadRequestException({
          message: 'i18n:errors.menu.modifierRequired',
          item: menuItem.name,
          modifier: modifier.name,
        });
      }

      const limit = modifier.maxSelections ?? Number.POSITIVE_INFINITY;

      if (count > limit) {
        throw new BadRequestException({
          message: 'i18n:errors.menu.modifierTooMany',
          modifier: modifier.name,
          max: limit,
        });
      }
    }
  }

  private resolveModifiers(
    menuItem: MenuItem,
    selections: Array<{ name: string; label: string }>,
  ): SelectedModifier[] {
    this.assertSelectionCounts(menuItem, selections);

    return selections.map((selection) => {
      const modifier = menuItem.modifiers.find(
        (candidate) => candidate.name === selection.name,
      );

      if (!modifier) {
        throw new BadRequestException(
          `${menuItem.name} has no modifier "${selection.name}"`,
        );
      }

      const option = modifier.options.find(
        (candidate) => candidate.label === selection.label,
      );

      if (!option) {
        throw new BadRequestException(
          `"${selection.label}" is not an option for ${selection.name}`,
        );
      }

      return {
        name: modifier.name,
        label: option.label,
        priceDeltaCents: option.priceDeltaCents,
      };
    });
  }
}
