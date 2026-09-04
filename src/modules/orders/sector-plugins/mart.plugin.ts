import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  lineTotalForSubUnits,
  subUnitPriceCents,
} from '../../products/pack-pricing';
import type { Sector } from '../../../database/schema';
import { ProductsRepository } from '../../products/products.repository';
import type { CheckoutItemDto } from '../dto/order-request.dto';
import type {
  CheckoutContext,
  CheckoutLine,
  SectorPlugin,
} from './sector-plugin.interface';

const QUANTITY_SCALE = 3;

@Injectable()
export class MartSectorPlugin implements SectorPlugin {
  readonly sector: Sector = 'mart';
  billsOnCreate(): boolean {
    return true;
  }

  constructor(private readonly productsRepository: ProductsRepository) {}

  beforeCreate(): void {}

  async onLineItemAdd(
    context: CheckoutContext,
    item: CheckoutItemDto,
  ): Promise<CheckoutLine[]> {
    if (item.batchId) {
      throw new BadRequestException(
        'batchId is not applicable to the mart sector',
      );
    }

    if (!item.productId) {
      throw new BadRequestException('productId is required');
    }

    const quantityText = item.quantity.toFixed(QUANTITY_SCALE);

    const product = await this.productsRepository.decrementStock(
      context.executor,
      context.business.id,
      context.branch.id,
      item.productId,
      quantityText,
    );

    if (!product) {
      throw new ConflictException({
        message: 'i18n:errors.stock.insufficient',
        productId: item.productId,
        quantity: quantityText,
      });
    }

    return [
      {
        product,
        note: item.note ?? null,
        quantity: item.quantity,
        unitPriceCents: subUnitPriceCents(
          product.priceCents,
          product.unitsPerPack,
        ),
        lineTotalCents: lineTotalForSubUnits(
          product.priceCents,
          product.unitsPerPack,
          item.quantity,
        ),
        batchId: null,
      },
    ];
  }

  async beforeCheckout(): Promise<void> {}

  async afterCheckout(): Promise<void> {}
}
