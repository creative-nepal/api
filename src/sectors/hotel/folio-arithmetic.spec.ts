import { nightsBetween, overlaps, roomCharge } from './folio-arithmetic';

describe('nightsBetween', () => {
  it('counts nights, not days — a Friday to Sunday stay is two nights', () => {
    expect(nightsBetween('2026-09-04', '2026-09-06')).toBe(2);
  });

  it('is one night for consecutive days', () => {
    expect(nightsBetween('2026-09-04', '2026-09-05')).toBe(1);
  });

  it('is zero when someone checks out the day they arrive', () => {
    expect(nightsBetween('2026-09-04', '2026-09-04')).toBe(0);
  });

  it('counts across a month boundary', () => {
    expect(nightsBetween('2026-08-30', '2026-09-02')).toBe(3);
  });

  it('is unaffected by Nepal being 5:45 ahead of UTC', () => {
    expect(nightsBetween('2026-09-04', '2026-09-11')).toBe(7);
  });
});

describe('roomCharge', () => {
  it('bills the nightly rate once per night', () => {
    expect(roomCharge('2026-09-04', '2026-09-07', 450000)).toEqual({
      nights: 3,
      roomChargeCents: 1350000,
    });
  });

  it('bills nothing for a same-day check-out rather than going negative', () => {
    expect(roomCharge('2026-09-04', '2026-09-04', 450000).roomChargeCents).toBe(
      0,
    );
  });
});

describe('overlaps', () => {
  it('lets one guest check out on the day the next checks in', () => {
    expect(
      overlaps('2026-09-01', '2026-09-04', '2026-09-04', '2026-09-06'),
    ).toBe(false);
  });

  it('catches a booking that starts mid-stay', () => {
    expect(
      overlaps('2026-09-01', '2026-09-05', '2026-09-03', '2026-09-08'),
    ).toBe(true);
  });

  it('catches a booking wholly inside another', () => {
    expect(
      overlaps('2026-09-01', '2026-09-10', '2026-09-03', '2026-09-05'),
    ).toBe(true);
  });

  it('catches a booking that swallows another', () => {
    expect(
      overlaps('2026-09-03', '2026-09-05', '2026-09-01', '2026-09-10'),
    ).toBe(true);
  });

  it('is false for stays that never touch', () => {
    expect(
      overlaps('2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10'),
    ).toBe(false);
  });
});
