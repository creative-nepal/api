import { expandOccurrences } from './recurrence';

const at = (iso: string) => new Date(iso);
const days = (list: Date[]) => list.map((d) => d.toISOString().slice(0, 10));

describe('expandOccurrences', () => {
  describe('without a rule', () => {
    it('returns the single start when it falls in the window', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-10T04:00:00Z'),
            null,
            at('2026-09-01T00:00:00Z'),
            at('2026-09-30T00:00:00Z'),
          ),
        ),
      ).toEqual(['2026-09-10']);
    });

    it('returns nothing when the start is outside the window', () => {
      expect(
        expandOccurrences(
          at('2026-08-10T04:00:00Z'),
          null,
          at('2026-09-01T00:00:00Z'),
          at('2026-09-30T00:00:00Z'),
        ),
      ).toEqual([]);
    });
  });

  describe('daily', () => {
    it('emits one per day', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-01T04:00:00Z'),
            { freq: 'daily', interval: 1 },
            at('2026-09-01T00:00:00Z'),
            at('2026-09-05T23:59:59Z'),
          ),
        ),
      ).toEqual([
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
      ]);
    });

    it('honours an interval', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-01T04:00:00Z'),
            { freq: 'daily', interval: 3 },
            at('2026-09-01T00:00:00Z'),
            at('2026-09-10T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-10']);
    });

    it('stops at count, counting occurrences before the window too', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-01T04:00:00Z'),
            { freq: 'daily', interval: 1, count: 3 },
            at('2026-09-01T00:00:00Z'),
            at('2026-09-30T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    });

    it('stops at until', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-01T04:00:00Z'),
            { freq: 'daily', interval: 1, until: '2026-09-03T23:59:59Z' },
            at('2026-09-01T00:00:00Z'),
            at('2026-09-30T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    });
  });

  describe('weekly', () => {
    it('repeats on the start weekday when none is given', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-01T04:00:00Z'),
            { freq: 'weekly', interval: 1 },
            at('2026-09-01T00:00:00Z'),
            at('2026-09-22T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22']);
    });

    it('emits several weekdays in one week', () => {
      const result = days(
        expandOccurrences(
          at('2026-09-01T04:00:00Z'),
          { freq: 'weekly', interval: 1, byWeekday: [0, 3] },
          at('2026-09-01T00:00:00Z'),
          at('2026-09-14T23:59:59Z'),
        ),
      );

      expect(result).toContain('2026-09-02');
      expect(result).toContain('2026-09-06');
      expect(result).toContain('2026-09-09');
    });

    it('never emits before the start', () => {
      const result = expandOccurrences(
        at('2026-09-01T04:00:00Z'),
        { freq: 'weekly', interval: 1, byWeekday: [0] },
        at('2026-08-01T00:00:00Z'),
        at('2026-09-14T23:59:59Z'),
      );

      expect(result.every((date) => date >= at('2026-09-01T04:00:00Z'))).toBe(
        true,
      );
    });
  });

  describe('monthly', () => {
    it('repeats on the same day of month', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-09-15T04:00:00Z'),
            { freq: 'monthly', interval: 1 },
            at('2026-09-01T00:00:00Z'),
            at('2026-12-31T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15']);
    });

    it('skips a month with no 31st rather than sliding to the 30th', () => {
      const result = days(
        expandOccurrences(
          at('2026-01-31T04:00:00Z'),
          { freq: 'monthly', interval: 1 },
          at('2026-01-01T00:00:00Z'),
          at('2026-05-31T23:59:59Z'),
        ),
      );

      expect(result).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
      expect(result).not.toContain('2026-02-28');
      expect(result).not.toContain('2026-04-30');
    });
  });

  describe('yearly', () => {
    it('repeats on the same date', () => {
      expect(
        days(
          expandOccurrences(
            at('2026-07-16T04:00:00Z'),
            { freq: 'yearly', interval: 1 },
            at('2026-01-01T00:00:00Z'),
            at('2028-12-31T23:59:59Z'),
          ),
        ),
      ).toEqual(['2026-07-16', '2027-07-16', '2028-07-16']);
    });

    it('skips 29 February outside a leap year', () => {
      const result = days(
        expandOccurrences(
          at('2024-02-29T04:00:00Z'),
          { freq: 'yearly', interval: 1 },
          at('2024-01-01T00:00:00Z'),
          at('2029-12-31T23:59:59Z'),
        ),
      );

      expect(result).toEqual(['2024-02-29', '2028-02-29']);
    });
  });

  describe('safety', () => {
    it('does not run away on an endless daily rule', () => {
      const result = expandOccurrences(
        at('2020-01-01T00:00:00Z'),
        { freq: 'daily', interval: 1 },
        at('2020-01-01T00:00:00Z'),
        at('2400-01-01T00:00:00Z'),
      );

      expect(result.length).toBeLessThanOrEqual(1_000);
    });

    it('treats a zero interval as one rather than looping', () => {
      const result = expandOccurrences(
        at('2026-09-01T00:00:00Z'),
        { freq: 'daily', interval: 0 },
        at('2026-09-01T00:00:00Z'),
        at('2026-09-03T23:59:59Z'),
      );

      expect(days(result)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    });
  });
});
