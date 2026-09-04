import type { Recurrence } from '../../database/schema';

const DAY_MS = 86_400_000;

const MAX_OCCURRENCES = 1_000;

function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const shifted = new Date(from.getTime());

  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);

  const daysInMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();

  if (day > daysInMonth) {
    return new Date(Number.NaN);
  }

  shifted.setUTCDate(day);
  return shifted;
}

function addYears(from: Date, years: number): Date {
  const shifted = new Date(from.getTime());
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);

  if (shifted.getUTCMonth() !== month || shifted.getUTCDate() !== day) {
    return new Date(Number.NaN);
  }

  return shifted;
}

function weeklyStarts(start: Date, byWeekday: number[]): Date[] {
  const weekStart = new Date(start.getTime() - start.getUTCDay() * DAY_MS);

  return [...byWeekday]
    .sort((a, b) => a - b)
    .map((weekday) => new Date(weekStart.getTime() + weekday * DAY_MS));
}

export function expandOccurrences(
  start: Date,
  recurrence: Recurrence | null,
  from: Date,
  to: Date,
): Date[] {
  if (!recurrence) {
    return start >= from && start <= to ? [start] : [];
  }

  const interval = Math.max(1, recurrence.interval);
  const until = recurrence.until ? new Date(recurrence.until) : null;
  const limit = recurrence.count ?? MAX_OCCURRENCES;

  const stopAt = until && until < to ? until : to;
  const occurrences: Date[] = [];

  let emitted = 0;
  let step = 0;

  while (emitted < limit && step < MAX_OCCURRENCES) {
    const candidates =
      recurrence.freq === 'weekly'
        ? weeklyStarts(
            new Date(start.getTime() + step * interval * 7 * DAY_MS),
            recurrence.byWeekday?.length
              ? recurrence.byWeekday
              : [start.getUTCDay()],
          )
        : [
            recurrence.freq === 'daily'
              ? new Date(start.getTime() + step * interval * DAY_MS)
              : recurrence.freq === 'monthly'
                ? addMonths(start, step * interval)
                : addYears(start, step * interval),
          ];

    step += 1;

    const valid = candidates.filter(
      (date) => !Number.isNaN(date.getTime()) && date >= start,
    );

    if (valid.length === 0) {
      const probe =
        recurrence.freq === 'monthly'
          ? addMonths(
              new Date(
                Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
              ),
              step * interval,
            )
          : recurrence.freq === 'yearly'
            ? new Date(Date.UTC(start.getUTCFullYear() + step * interval, 0, 1))
            : new Date(start.getTime() + step * interval * DAY_MS);

      if (probe > stopAt) {
        break;
      }

      continue;
    }

    let past = false;

    for (const date of valid) {
      if (date > stopAt) {
        past = true;
        break;
      }

      emitted += 1;

      if (date >= from) {
        occurrences.push(date);
      }

      if (emitted >= limit) {
        break;
      }
    }

    if (past) {
      break;
    }
  }

  return occurrences;
}

export function describeRecurrence(recurrence: Recurrence | null): string {
  if (!recurrence) {
    return 'once';
  }

  const every =
    recurrence.interval > 1 ? `every ${recurrence.interval} ` : 'every ';

  const unit = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  }[recurrence.freq];

  return `${every}${unit}${recurrence.interval > 1 ? 's' : ''}`;
}
