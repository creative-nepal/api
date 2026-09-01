import { addMonthsUtc, billingPeriodEnd } from './billing-period';

describe('addMonthsUtc', () => {
  it('adds a plain month', () => {
    expect(
      addMonthsUtc(new Date('2026-01-15T10:30:00Z'), 1).toISOString(),
    ).toBe('2026-02-15T10:30:00.000Z');
  });

  it('clamps to the last day of a shorter target month', () => {
    expect(
      addMonthsUtc(new Date('2026-01-31T00:00:00Z'), 1).toISOString(),
    ).toBe('2026-02-28T00:00:00.000Z');
  });

  it('handles a leap year', () => {
    expect(
      addMonthsUtc(new Date('2028-01-31T00:00:00Z'), 1).toISOString(),
    ).toBe('2028-02-29T00:00:00.000Z');
  });

  it('rolls the year over', () => {
    expect(
      addMonthsUtc(new Date('2026-12-15T00:00:00Z'), 1).toISOString(),
    ).toBe('2027-01-15T00:00:00.000Z');
  });
});

describe('billingPeriodEnd', () => {
  it('adds one month for a monthly cycle', () => {
    expect(
      billingPeriodEnd(
        new Date('2026-03-10T00:00:00Z'),
        'monthly',
      ).toISOString(),
    ).toBe('2026-04-10T00:00:00.000Z');
  });

  it('adds twelve months for a yearly cycle', () => {
    expect(
      billingPeriodEnd(
        new Date('2026-03-10T00:00:00Z'),
        'yearly',
      ).toISOString(),
    ).toBe('2027-03-10T00:00:00.000Z');
  });
});
