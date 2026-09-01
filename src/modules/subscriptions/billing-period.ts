import type { BillingCycle } from '../../database/schema';

export function addMonthsUtc(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );

  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, daysInTargetMonth));
  target.setUTCHours(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );

  return target;
}

export function billingPeriodEnd(start: Date, cycle: BillingCycle): Date {
  return addMonthsUtc(start, cycle === 'yearly' ? 12 : 1);
}
