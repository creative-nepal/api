import {
  type BikramSambatDate,
  toBikramSambat,
  toNepaliDate,
} from '../../common/dates/nepali';

export const DEFAULT_FISCAL_YEAR_START_MONTH = 4;

export type { BikramSambatDate };
export { toBikramSambat };

export function formatFiscalYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
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
