import { subUnitPriceCents } from '../products/pack-pricing';
import type { CheckoutLine } from './sector-plugins/sector-plugin.interface';

export function unitCostFor(line: CheckoutLine): number {
  const product = line.product;

  if (!product) {
    return 0;
  }

  return subUnitPriceCents(product.costPriceCents, product.unitsPerPack);
}
