import { computeVatCents, VAT_RATE_PERCENT } from './vat';

describe('computeVatCents', () => {
  it('is 13%', () => {
    expect(VAT_RATE_PERCENT).toBe(13);
  });

  it('returns zero for a business that is not VAT registered', () => {
    expect(computeVatCents(100_000, false)).toBe(0);
  });

  it('computes 13% for a VAT-registered business', () => {
    expect(computeVatCents(100_000, true)).toBe(13_000);
  });

  it('rounds to whole paisa rather than carrying a fraction', () => {
    expect(computeVatCents(1, true)).toBe(0);
    expect(computeVatCents(4, true)).toBe(1);
    expect(Number.isInteger(computeVatCents(12_345, true))).toBe(true);
  });
});
