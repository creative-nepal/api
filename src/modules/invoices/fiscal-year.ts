import NepaliDate from 'nepali-date-converter';

const NEPAL_UTC_OFFSET_MINUTES = 5 * 60 + 45;

export const DEFAULT_FISCAL_YEAR_START_MONTH = 4;

const SUPPORTED_RANGE_MESSAGE =
  'Date is outside the supported Bikram Sambat calendar range (BS 2000-2090)';

export interface BikramSambatDate {
  year: number;
  month: number;
  day: number;
  formatted: string;
}

function toNepaliDate(instant: Date): NepaliDate {
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

export function formatFiscalYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
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

export function fiscalYearLabel(
  instant: Date,
  fiscalYearStartMonth: number = DEFAULT_FISCAL_YEAR_START_MONTH,
): string {
  const bs = toNepaliDate(instant);
  const startMonthIndex = fiscalYearStartMonth - 1;

  const startYear =
    bs.getMonth() >= startMonthIndex ? bs.getYear() : bs.getYear() - 1;

  return formatFiscalYearLabel(startYear);
}
