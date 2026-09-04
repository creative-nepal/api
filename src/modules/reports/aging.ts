export interface AgingCharge {
  amountCents: number;
  at: Date;
}

export interface AgingBuckets {
  currentCents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  over90Cents: number;
  totalCents: number;
  oldestDays: number;
}

const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function settleOldestFirst(
  charges: AgingCharge[],
  paidCents: number,
): AgingCharge[] {
  const ordered = [...charges].sort((a, b) => a.at.getTime() - b.at.getTime());
  let remaining = Math.max(0, paidCents);
  const open: AgingCharge[] = [];

  for (const charge of ordered) {
    if (remaining >= charge.amountCents) {
      remaining -= charge.amountCents;
      continue;
    }

    open.push({ amountCents: charge.amountCents - remaining, at: charge.at });
    remaining = 0;
  }

  return open;
}

export function bucket(charges: AgingCharge[], asOf: Date): AgingBuckets {
  const buckets: AgingBuckets = {
    currentCents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    over90Cents: 0,
    totalCents: 0,
    oldestDays: 0,
  };

  for (const charge of charges) {
    const age = daysBetween(charge.at, asOf);

    if (age > 90) {
      buckets.over90Cents += charge.amountCents;
    } else if (age > 60) {
      buckets.days61To90Cents += charge.amountCents;
    } else if (age > 30) {
      buckets.days31To60Cents += charge.amountCents;
    } else {
      buckets.currentCents += charge.amountCents;
    }

    buckets.totalCents += charge.amountCents;
    buckets.oldestDays = Math.max(buckets.oldestDays, age);
  }

  return buckets;
}
