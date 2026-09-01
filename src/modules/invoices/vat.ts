export const VAT_RATE_PERCENT = 13;

export function computeVatCents(
  subtotalCents: number,
  vatRegistered: boolean,
): number {
  if (!vatRegistered) {
    return 0;
  }

  return Math.round((subtotalCents * VAT_RATE_PERCENT) / 100);
}
