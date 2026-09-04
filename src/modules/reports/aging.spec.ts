import { type AgingCharge, bucket, settleOldestFirst } from './aging';

const asOf = new Date('2026-09-04T00:00:00Z');

function daysAgo(days: number): Date {
  return new Date(asOf.getTime() - days * 86_400_000);
}

function charge(amountCents: number, days: number): AgingCharge {
  return { amountCents, at: daysAgo(days) };
}

describe('settleOldestFirst', () => {
  it('clears the oldest debt first, the way a shopkeeper applies a payment', () => {
    const open = settleOldestFirst(
      [charge(1000, 10), charge(2000, 100), charge(500, 50)],
      2200,
    );

    expect(open).toEqual([
      { amountCents: 300, at: daysAgo(50) },
      { amountCents: 1000, at: daysAgo(10) },
    ]);
  });

  it('leaves everything open when nothing has been paid', () => {
    expect(settleOldestFirst([charge(1000, 5)], 0)).toHaveLength(1);
  });

  it('clears everything when the payment covers the lot', () => {
    expect(settleOldestFirst([charge(1000, 5), charge(400, 2)], 1400)).toEqual(
      [],
    );
  });

  it('ignores an overpayment rather than creating a negative charge', () => {
    expect(settleOldestFirst([charge(1000, 5)], 5000)).toEqual([]);
  });
});

describe('bucket', () => {
  it('splits charges across the four aging columns by their own age', () => {
    const result = bucket(
      [charge(100, 1), charge(200, 45), charge(400, 75), charge(800, 200)],
      asOf,
    );

    expect(result).toEqual({
      currentCents: 100,
      days31To60Cents: 200,
      days61To90Cents: 400,
      over90Cents: 800,
      totalCents: 1500,
      oldestDays: 200,
    });
  });

  it('puts a charge exactly on a boundary in the younger bucket', () => {
    expect(bucket([charge(100, 30)], asOf).currentCents).toBe(100);
    expect(bucket([charge(100, 31)], asOf).days31To60Cents).toBe(100);
    expect(bucket([charge(100, 60)], asOf).days31To60Cents).toBe(100);
    expect(bucket([charge(100, 90)], asOf).days61To90Cents).toBe(100);
    expect(bucket([charge(100, 91)], asOf).over90Cents).toBe(100);
  });

  it('reports nothing outstanding for a customer with no open charges', () => {
    expect(bucket([], asOf).totalCents).toBe(0);
  });
});
