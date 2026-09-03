import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
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
        quantity: item.quantity,
        unitPriceCents,
        lineTotalCents: Math.round(unitPriceCents * item.quantity),
        batchId: null,
      },
    ];
  }

  async beforeCheckout(): Promise<void> {}

  async afterCheckout(): Promise<void> {}

  private resolveModifiers(
    menuItem: MenuItem,
    selections: Array<{ name: string; label: string }>,
  ): SelectedModifier[] {
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
