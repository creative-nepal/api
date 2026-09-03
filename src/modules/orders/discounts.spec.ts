import { BadRequestException } from '@nestjs/common';
import {
  apportion,
  assertWithinBase,
  assertWithinCap,
  resolveDiscountCents,
} from './discounts';

describe('resolveDiscountCents', () => {
  it('returns an explicit amount unchanged', () => {
    expect(resolveDiscountCents(5000, { discountCents: 750 })).toBe(750);
  });

  it('resolves a percent against the base', () => {
    expect(resolveDiscountCents(5000, { discountPercent: 10 })).toBe(500);
  });

  it('rounds a fractional percent to the nearest paisa', () => {
    expect(resolveDiscountCents(333, { discountPercent: 7.5 })).toBe(25);
  });

  it('is zero when neither is given', () => {
    expect(resolveDiscountCents(5000, {})).toBe(0);
  });

  it('refuses both at once', () => {
    expect(() =>
      resolveDiscountCents(5000, { discountCents: 100, discountPercent: 5 }),
    ).toThrow(BadRequestException);
  });
});

describe('assertWithinBase', () => {
  it('allows a discount equal to the base', () => {
    expect(() => assertWithinBase(5000, 5000)).not.toThrow();
  });

  it('refuses a discount larger than the base', () => {
    expect(() => assertWithinBase(5001, 5000)).toThrow(BadRequestException);
  });
});

describe('assertWithinCap', () => {
  it('ignores a zero discount even when discounts are off', () => {
    expect(() => assertWithinCap(0, 5000, 0)).not.toThrow();
  });

  it('refuses any discount when the cap is zero', () => {
    expect(() => assertWithinCap(1, 5000, 0)).toThrow(BadRequestException);
  });

  it('allows a discount exactly at the cap', () => {
    expect(() => assertWithinCap(500, 5000, 10)).not.toThrow();
  });

  it('refuses a discount one paisa above the cap', () => {
    expect(() => assertWithinCap(501, 5000, 10)).toThrow(BadRequestException);
  });
});

describe('apportion', () => {
  it('splits proportionally when it divides evenly', () => {
    expect(apportion(300, [1000, 2000])).toEqual([100, 200]);
  });

  it('gives the rounding remainder to the largest weight', () => {
    expect(apportion(100, [1000, 1000, 1000])).toEqual([34, 33, 33]);
  });

  it('always sums back to the total', () => {
    const shares = apportion(997, [123, 456, 789, 1]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(997);
  });

  it('is all zeroes when there is nothing to spread', () => {
    expect(apportion(0, [1000, 2000])).toEqual([0, 0]);
  });

  it('is all zeroes when every weight is zero', () => {
    expect(apportion(500, [0, 0])).toEqual([0, 0]);
  });
});
