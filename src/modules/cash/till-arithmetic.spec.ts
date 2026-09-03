import { expectedCashCents, varianceCents } from './till-arithmetic';

const base = {
  openingFloatCents: 500_000,
  cashSalesCents: 0,
  paidInCents: 0,
  paidOutCents: 0,
};

describe('expectedCashCents', () => {
  it('is the float alone before any trade', () => {
    expect(expectedCashCents(base)).toBe(500_000);
  });

  it('adds cash sales', () => {
    expect(expectedCashCents({ ...base, cashSalesCents: 10_650 })).toBe(
      510_650,
    );
  });

  it('subtracts money paid out of the drawer', () => {
    expect(expectedCashCents({ ...base, paidOutCents: 1_500 })).toBe(498_500);
  });

  it('adds money paid into the drawer', () => {
    expect(expectedCashCents({ ...base, paidInCents: 2_000 })).toBe(502_000);
  });

  it('combines every movement', () => {
    expect(
      expectedCashCents({
        openingFloatCents: 500_000,
        cashSalesCents: 10_650,
        paidInCents: 0,
        paidOutCents: 1_500,
      }),
    ).toBe(509_150);
  });

  it('ignores non-cash tender, which never reaches the drawer', () => {
    // eSewa and card settle to the bank, so they must not move expected cash.
    const withCardSales = expectedCashCents({ ...base, cashSalesCents: 0 });
    expect(withCardSales).toBe(500_000);
  });
});

describe('varianceCents', () => {
  it('is zero when the count matches', () => {
    expect(varianceCents(509_150, 509_150)).toBe(0);
  });

  it('is negative when the drawer is short', () => {
    expect(varianceCents(509_000, 509_150)).toBe(-150);
  });

  it('is positive when the drawer is over', () => {
    expect(varianceCents(509_300, 509_150)).toBe(150);
  });
});
