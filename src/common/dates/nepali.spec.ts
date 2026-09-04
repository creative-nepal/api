import { fromBikramSambat, toBikramSambat, toDualDate } from './nepali';

const utc = (iso: string) => new Date(iso);

describe('toBikramSambat', () => {
  it('converts a known date', () => {
    expect(toBikramSambat(utc('2026-09-03T06:00:00Z')).formatted).toBe(
      '2083-05-18',
    );
  });

  it('converts the Nepali new year', () => {
    expect(toBikramSambat(utc('2026-04-14T06:00:00Z')).formatted).toBe(
      '2083-01-01',
    );
  });

  it('rolls over at Nepali midnight, not UTC midnight', () => {
    const beforeNepaliMidnight = toBikramSambat(utc('2026-09-03T18:00:00Z'));
    const afterNepaliMidnight = toBikramSambat(utc('2026-09-03T18:30:00Z'));

    expect(beforeNepaliMidnight.formatted).toBe('2083-05-18');
    expect(afterNepaliMidnight.formatted).toBe('2083-05-19');
  });

  it('exposes the parts as numbers', () => {
    const bs = toBikramSambat(utc('2026-09-03T06:00:00Z'));

    expect(bs.year).toBe(2083);
    expect(bs.month).toBe(5);
    expect(bs.day).toBe(18);
  });
});

describe('fromBikramSambat', () => {
  it('converts back to the instant Nepali midnight begins', () => {
    expect(fromBikramSambat(2083, 5, 19).toISOString()).toBe(
      '2026-09-03T18:15:00.000Z',
    );
  });

  it('lands on the right Nepali day when read back', () => {
    const midday = new Date(
      fromBikramSambat(2083, 5, 19).getTime() + 12 * 3_600_000,
    );

    expect(toBikramSambat(midday).formatted).toBe('2083-05-19');
  });

  it('round-trips every month of a year', () => {
    for (let month = 1; month <= 12; month += 1) {
      const ad = fromBikramSambat(2083, month, 15);
      const back = toBikramSambat(new Date(ad.getTime() + 12 * 3_600_000));

      expect(back.year).toBe(2083);
      expect(back.month).toBe(month);
      expect(back.day).toBe(15);
    }
  });

  it('handles a 32-day Nepali month, which Gregorian never has', () => {
    const ad = fromBikramSambat(2083, 3, 32);
    const back = toBikramSambat(new Date(ad.getTime() + 12 * 3_600_000));

    expect(back.formatted).toBe('2083-03-32');
  });

  it('round-trips every day of an irregular year', () => {
    const lengths = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];

    for (const [index, length] of lengths.entries()) {
      const month = index + 1;
      const ad = fromBikramSambat(2083, month, length);
      const back = toBikramSambat(new Date(ad.getTime() + 12 * 3_600_000));

      expect(back.month).toBe(month);
      expect(back.day).toBe(length);
    }
  });

  it('refuses a date outside the supported range', () => {
    expect(() => fromBikramSambat(1900, 1, 1)).toThrow(RangeError);
  });
});

describe('toDualDate', () => {
  it('carries both calendars and both scripts', () => {
    const dual = toDualDate(utc('2026-09-03T06:00:00Z'));

    expect(dual.ad).toBe('2026-09-03');
    expect(dual.bs).toBe('2083-05-18');
    expect(dual.bsLong).toBe('2083 Bhadra 18');
    expect(dual.bsNepali).toContain('भाद्र');
  });

  it('writes Nepali numerals in the Nepali form', () => {
    expect(toDualDate(utc('2026-09-03T06:00:00Z')).bsNepali).toMatch(/[०-९]/);
  });
});
