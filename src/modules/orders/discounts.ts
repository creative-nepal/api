import { BadRequestException } from '@nestjs/common';

export interface DiscountInput {
  discountCents?: number;
  discountPercent?: number;
}

export function resolveDiscountCents(
  baseCents: number,
  input: DiscountInput,
): number {
  if (
    input.discountCents !== undefined &&
    input.discountPercent !== undefined
  ) {
    throw new BadRequestException('i18n:errors.discount.ambiguous');
  }

  if (input.discountPercent !== undefined) {
    return Math.round((baseCents * input.discountPercent) / 100);
  }

  return input.discountCents ?? 0;
}

export function assertWithinBase(
  discountCents: number,
  baseCents: number,
): void {
  if (discountCents > baseCents) {
    throw new BadRequestException('i18n:errors.discount.exceedsAmount');
  }
}

export function assertWithinCap(
  discountCents: number,
  grossCents: number,
  maxDiscountPercent: number,
): void {
  if (discountCents === 0) {
    return;
  }

  if (maxDiscountPercent <= 0) {
    throw new BadRequestException('i18n:errors.discount.notAllowed');
  }

  if (discountCents * 100 > grossCents * maxDiscountPercent) {
    throw new BadRequestException('i18n:errors.discount.exceedsCap');
  }
}

export function apportion(totalCents: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalCents === 0 || weightSum === 0) {
    return weights.map(() => 0);
  }

  const shares = weights.map((weight) =>
    Math.floor((totalCents * weight) / weightSum),
  );

  let remainder = totalCents - shares.reduce((sum, share) => sum + share, 0);

  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const entry of order) {
    if (remainder <= 0) {
      break;
    }
    shares[entry.index] += 1;
    remainder -= 1;
  }

  return shares;
}
