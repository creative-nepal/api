import { weightedAverageCostCents } from './weighted-average';

describe('weightedAverageCostCents', () => {
  it('averages against existing stock', () => {
    expect(
      weightedAverageCostCents({
        existingQty: 10,
        existingCostCents: 100,
        receivedQty: 10,
        purchasePriceCents: 200,
      }),
    ).toBe(150);
  });

  it('weights by quantity, not evenly', () => {
    expect(
      weightedAverageCostCents({
        existingQty: 90,
        existingCostCents: 100,
        receivedQty: 10,
        purchasePriceCents: 200,
      }),
    ).toBe(110);
  });

  it('does not divide by zero on an empty product', () => {
    expect(
      weightedAverageCostCents({
        existingQty: 0,
        existingCostCents: 0,
        receivedQty: 0,
        purchasePriceCents: 500,
      }),
    ).toBe(0);

    expect(
      weightedAverageCostCents({
        existingQty: 0,
        existingCostCents: 0,
        receivedQty: 5,
        purchasePriceCents: 500,
      }),
    ).toBe(500);
  });

  it('ignores negative existing stock rather than producing garbage', () => {
    expect(
      weightedAverageCostCents({
        existingQty: -5,
        existingCostCents: 100,
        receivedQty: 10,
        purchasePriceCents: 200,
      }),
    ).toBe(200);
  });

  it('leaves cost untouched when nothing is received', () => {
    expect(
      weightedAverageCostCents({
        existingQty: 10,
        existingCostCents: 100,
        receivedQty: 0,
        purchasePriceCents: 999,
      }),
    ).toBe(100);
  });

  it('always returns an integer number of paisa', () => {
    const result = weightedAverageCostCents({
      existingQty: 3,
      existingCostCents: 100,
      receivedQty: 4,
      purchasePriceCents: 175,
    });
    expect(Number.isInteger(result)).toBe(true);
  });
});
