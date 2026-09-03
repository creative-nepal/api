import {
  describePackStock,
  lineTotalForSubUnits,
  subUnitPriceCents,
} from './pack-pricing';

describe('subUnitPriceCents', () => {
  it('is the pack price when the pack is the unit', () => {
    expect(subUnitPriceCents(2500, 1)).toBe(2500);
  });

  it('divides evenly where it can', () => {
    expect(subUnitPriceCents(2000, 10)).toBe(200);
  });

  it('rounds where the pack price does not divide', () => {
    expect(subUnitPriceCents(2000, 3)).toBe(667);
  });
});

describe('lineTotalForSubUnits', () => {
  it('prices loose units as a share of the pack', () => {
    expect(lineTotalForSubUnits(2000, 10, 4)).toBe(800);
  });

  it('prices a whole pack at exactly the pack price', () => {
    expect(lineTotalForSubUnits(2000, 3, 3)).toBe(2000);
  });

  it('does not accumulate the per-unit rounding error', () => {
    // 667 x 3 would be 2001; pricing from the pack keeps it honest.
    expect(lineTotalForSubUnits(2000, 3, 3)).not.toBe(
      subUnitPriceCents(2000, 3) * 3,
    );
  });

  it('prices several whole packs exactly', () => {
    expect(lineTotalForSubUnits(2000, 3, 9)).toBe(6000);
  });

  it('behaves as a plain multiply when the pack is the unit', () => {
    expect(lineTotalForSubUnits(2500, 1, 2)).toBe(5000);
  });
});

describe('describePackStock', () => {
  it('splits sub-units into packs and a remainder', () => {
    expect(describePackStock(496, 10)).toEqual({ packs: 49, loose: 6 });
  });

  it('reports no remainder for a whole number of packs', () => {
    expect(describePackStock(30, 3)).toEqual({ packs: 10, loose: 0 });
  });

  it('treats everything as packs when the pack is the unit', () => {
    expect(describePackStock(42, 1)).toEqual({ packs: 42, loose: 0 });
  });
});
