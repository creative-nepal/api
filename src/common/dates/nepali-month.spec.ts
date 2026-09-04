import { bikramSambatMonth, toBikramSambat } from './nepali';

describe('bikramSambatMonth', () => {
  it('reports the right length for each month of 2083', () => {
    const lengths = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];

    for (const [index, length] of lengths.entries()) {
      expect(bikramSambatMonth(2083, index + 1).days).toBe(length);
    }
  });

  it('spans the whole month and nothing more', () => {
    const month = bikramSambatMonth(2083, 5);

    expect(toBikramSambat(new Date(month.from.getTime() + 3_600_000)).day).toBe(
      1,
    );
    expect(toBikramSambat(new Date(month.to.getTime() - 3_600_000)).day).toBe(
      month.days,
    );
  });

  it('does not bleed into the next month', () => {
    const month = bikramSambatMonth(2083, 5);
    const justAfter = toBikramSambat(new Date(month.to.getTime() + 3_600_000));

    expect(justAfter.month).toBe(6);
    expect(justAfter.day).toBe(1);
  });

  it('carries the month name in both scripts', () => {
    const month = bikramSambatMonth(2083, 5);

    expect(month.name).toBe('Bhadra');
    expect(month.nameNepali).toBe('भाद्र');
  });
});
