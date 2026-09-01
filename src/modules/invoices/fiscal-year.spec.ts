import {
  fiscalYearLabel,
  formatFiscalYearLabel,
  toBikramSambat,
} from './fiscal-year';

function withTimezone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = previous;
  }
}

describe('toBikramSambat', () => {
  it('converts a known AD date to BS', () => {
    expect(toBikramSambat(new Date('2024-04-13T06:00:00Z')).formatted).toBe(
      '2081-01-01',
    );
  });

  it('resolves Shrawan 1 correctly', () => {
    expect(toBikramSambat(new Date('2025-07-17T06:00:00Z')).formatted).toBe(
      '2082-04-01',
    );
  });
});

describe('fiscalYearLabel', () => {
  it('labels a date after Shrawan 1 with the opening BS year', () => {
    expect(fiscalYearLabel(new Date('2026-08-17T06:00:00Z'))).toBe('2083-84');
  });

  it('labels a date before Shrawan 1 with the previous BS year', () => {
    expect(fiscalYearLabel(new Date('2026-07-14T06:00:00Z'))).toBe('2082-83');
  });

  it('rolls over exactly at Shrawan 1', () => {
    expect(fiscalYearLabel(new Date('2026-07-16T10:00:00Z'))).toBe('2082-83');
    expect(fiscalYearLabel(new Date('2026-07-17T06:00:00Z'))).toBe('2083-84');
  });

  it('is independent of the server timezone at the fiscal-year boundary', () => {
    const instant = new Date('2026-07-16T19:00:00Z');

    for (const tz of ['UTC', 'Asia/Kathmandu', 'America/Los_Angeles']) {
      expect(withTimezone(tz, () => fiscalYearLabel(instant))).toBe('2083-84');
    }
  });

  it('throws a legible error outside the supported BS calendar range', () => {
    expect(() => fiscalYearLabel(new Date('2042-07-17T06:00:00Z'))).toThrow(
      /supported Bikram Sambat calendar range/,
    );
  });
});

describe('formatFiscalYearLabel', () => {
  it('pads the trailing year to two digits', () => {
    expect(formatFiscalYearLabel(2082)).toBe('2082-83');
    expect(formatFiscalYearLabel(2099)).toBe('2099-00');
    expect(formatFiscalYearLabel(2100)).toBe('2100-01');
  });
});
