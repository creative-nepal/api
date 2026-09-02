import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { schema } from '../../../database';
import type { Sector } from '../../../database/schema';
import type { CheckoutItemDto } from '../dto/order-request.dto';
import type {
  CheckoutContext,
  CheckoutLine,
  SectorPlugin,
} from './sector-plugin.interface';

@Injectable()
export class ServicesSectorPlugin implements SectorPlugin {
  readonly sector: Sector = 'services';

  readonly billsOnCreate = true;

  beforeCreate(): void {}

  async onLineItemAdd(
    context: CheckoutContext,
    item: CheckoutItemDto,
  ): Promise<CheckoutLine[]> {
    if (item.batchId) {
      throw new BadRequestException(
        'batchId is not applicable to the services sector',
      );
    }

    const serviceItemId = item.serviceItemId ?? item.productId;

    if (!serviceItemId) {
      throw new BadRequestException('serviceItemId is required');
    }

    const [serviceItem] = await context.executor
      .select()
      .from(schema.serviceItems)
      .where(
        and(
          eq(schema.serviceItems.businessId, context.business.id),
          eq(schema.serviceItems.id, serviceItemId),
        ),
      )
      .limit(1);

    if (!serviceItem) {
      throw new NotFoundException({
        message: 'i18n:errors.services.itemNotFound',
        serviceItemId,
      });
    }

    if (!serviceItem.isActive) {
      throw new BadRequestException({
        message: 'i18n:errors.services.itemInactive',
        serviceItemId,
      });
    }

    return [
      {
        product: null,
        serviceItem,
        quantity: item.quantity,
        unitPriceCents: serviceItem.priceCents,
        lineTotalCents: Math.round(serviceItem.priceCents * item.quantity),
        batchId: null,
      },
    ];
  }

  async beforeCheckout(): Promise<void> {}

  async afterCheckout(): Promise<void> {}
}
