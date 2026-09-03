export interface TillMovements {
  openingFloatCents: number;
  cashSalesCents: number;
  paidInCents: number;
  paidOutCents: number;
}

export function expectedCashCents(movements: TillMovements): number {
  return (
    movements.openingFloatCents +
    movements.cashSalesCents +
    movements.paidInCents -
    movements.paidOutCents
  );
}

export function varianceCents(
  countedCashCents: number,
  expected: number,
): number {
  return countedCashCents - expected;
}
