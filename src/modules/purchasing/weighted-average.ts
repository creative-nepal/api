export function weightedAverageCostCents(params: {
  existingQty: number;
  existingCostCents: number;
  receivedQty: number;
  purchasePriceCents: number;
}): number {
  const { existingQty, existingCostCents, receivedQty, purchasePriceCents } =
    params;

  if (receivedQty <= 0) {
    return existingCostCents;
  }

  if (existingQty <= 0) {
    return purchasePriceCents;
  }

  const total =
    existingQty * existingCostCents + receivedQty * purchasePriceCents;

  return Math.round(total / (existingQty + receivedQty));
}
