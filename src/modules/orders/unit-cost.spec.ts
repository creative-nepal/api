import type { CheckoutLine } from './sector-plugins/sector-plugin.interface';
import { unitCostFor } from './unit-cost';

function line(overrides: Partial<CheckoutLine['product']>): CheckoutLine {
  return {
    product: {
      costPriceCents: 0,
      unitsPerPack: 1,
      ...overrides,
    } as NonNullable<CheckoutLine['product']>,
    quantity: 1,
    unitPriceCents: 0,
    lineTotalCents: 0,
    batchId: null,
  };
}

describe('unitCostFor', () => {
  it('is zero for a line with no product, such as a service or a menu item', () => {
    expect(
      unitCostFor({
        product: null,
        quantity: 1,
        unitPriceCents: 0,
        lineTotalCents: 0,
        batchId: null,
      }),
    ).toBe(0);
  });

  it('uses the cost as-is when the product is not packed', () => {
    expect(unitCostFor(line({ costPriceCents: 1500, unitsPerPack: 1 }))).toBe(
      1500,
    );
  });

  it('divides a pack cost down to the sub-unit that is actually sold', () => {
    expect(unitCostFor(line({ costPriceCents: 1500, unitsPerPack: 10 }))).toBe(
      150,
    );
  });

  it('matches how the sale price is converted, so margin is not skewed by packing', () => {
    const cost = unitCostFor(line({ costPriceCents: 2000, unitsPerPack: 3 }));

    expect(cost).toBe(667);
  });
});
