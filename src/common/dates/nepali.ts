import NepaliDate from 'nepali-date-converter';

export const NEPAL_UTC_OFFSET_MINUTES = 5 * 60 + 45;

const SUPPORTED_RANGE_MESSAGE =
  'Date is outside the supported Bikram Sambat calendar range (BS 2000-2090)';

export interface BikramSambatDate {
  year: number;
  month: number;
  day: number;
  formatted: string;
}

export interface DualDate {
  ad: string;
  bs: string;
  bsLong: string;
  bsNepali: string;
}

export function toNepaliDate(instant: Date): NepaliDate {
  const shifted = new Date(
    instant.getTime() + NEPAL_UTC_OFFSET_MINUTES * 60_000,
  );

  try {
    return new NepaliDate(
      new Date(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
        12,
      ),
    );
  } catch (cause) {
    throw new RangeError(
      `${SUPPORTED_RANGE_MESSAGE}: ${instant.toISOString()}`,
      { cause },
    );
  }
}

export function toBikramSambat(instant: Date): BikramSambatDate {
  const bs = toNepaliDate(instant);

  return {
    year: bs.getYear(),
    month: bs.getMonth() + 1,
    day: bs.getDate(),
    formatted: bs.format('YYYY-MM-DD'),
  };
}

export function fromBikramSambat(
  year: number,
  month: number,
  day: number,
): Date {
  try {
    const local = new NepaliDate(year, month - 1, day).toJsDate();

    return new Date(
      Date.UTC(
        local.getFullYear(),
        local.getMonth(),
        local.getDate(),
        0,
        0,
        0,
      ).valueOf() -
        NEPAL_UTC_OFFSET_MINUTES * 60_000,
    );
  } catch (cause) {
    throw new RangeError(
      `${SUPPORTED_RANGE_MESSAGE}: ${year}-${month}-${day}`,
      { cause },
    );
  }
}

export function toDualDate(instant: Date): DualDate {
  const bs = toNepaliDate(instant);

  return {
    ad: instant.toISOString().slice(0, 10),
    bs: bs.format('YYYY-MM-DD'),
    bsLong: bs.format('YYYY MMMM DD'),
    bsNepali: bs.format('YYYY MMMM DD', 'np'),
  };
}

export interface BikramSambatMonth {
  year: number;
  month: number;
  name: string;
  nameNepali: string;
  days: number;
  from: Date;
  to: Date;
}

const MAX_MONTH_DAYS = 32;

export function bikramSambatMonth(
  year: number,
  month: number,
): BikramSambatMonth {
  const from = fromBikramSambat(year, month, 1);

  let days = MAX_MONTH_DAYS;

  while (days > 28) {
    try {
      const candidate = new NepaliDate(year, month - 1, days);

      if (candidate.getMonth() === month - 1 && candidate.getDate() === days) {
        break;
      }
    } catch {
      days -= 1;
      continue;
    }

    days -= 1;
  }

  const last = fromBikramSambat(year, month, days);
  const reference = new NepaliDate(year, month - 1, 1);

  return {
    year,
    month,
    name: reference.format('MMMM'),
    nameNepali: reference.format('MMMM', 'np'),
    days,
    from,
    to: new Date(last.getTime() + 86_400_000 - 1),
  };
}
