import { SECTOR_KEYS } from '../database/schema/sector-keys';
import {
  enabledSectorMeta,
  parseEnabledSectorKeys,
  SECTOR_CATALOG,
} from './catalog';

describe('parseEnabledSectorKeys', () => {
  it('defaults to every sector when unset or blank', () => {
    expect(parseEnabledSectorKeys(undefined)).toEqual([...SECTOR_KEYS]);
    expect(parseEnabledSectorKeys('   ')).toEqual([...SECTOR_KEYS]);
  });

  it('parses a subset, trimming and de-duplicating', () => {
    expect(parseEnabledSectorKeys(' medical , restaurant ,medical')).toEqual([
      'medical',
      'restaurant',
    ]);
  });

  it('rejects an unknown key rather than falling back to all', () => {
    expect(() => parseEnabledSectorKeys('medical,dental')).toThrow(/dental/);
  });
});

describe('SECTOR_CATALOG', () => {
  it('has an entry for every declared sector key', () => {
    for (const key of SECTOR_KEYS) {
      expect(SECTOR_CATALOG[key]?.key).toBe(key);
    }
  });

  it('names every sector through an i18n key, never a literal', () => {
    for (const key of SECTOR_KEYS) {
      expect(SECTOR_CATALOG[key].nameKey).toBe(`common.sector.${key}`);
    }
  });
});

describe('enabledSectorMeta', () => {
  it('returns only the enabled sectors, in the order given', () => {
    expect(
      enabledSectorMeta('restaurant,mart').map((meta) => meta.key),
    ).toEqual(['restaurant', 'mart']);
  });

  it('exposes the plan feature keys the admin plan form renders', () => {
    const [medical] = enabledSectorMeta('medical');

    expect(medical.planFeatureKeys).toContain('batchTracking');
    expect(enabledSectorMeta('mart')[0].planFeatureKeys).not.toContain(
      'batchTracking',
    );
  });
});

describe('a sector added to SECTOR_KEYS', () => {
  it('has a catalog entry, so the registry cannot be half-wired', () => {
    for (const key of SECTOR_KEYS) {
      const meta = SECTOR_CATALOG[key];

      expect(meta).toBeDefined();
      expect(meta.navItems.length).toBeGreaterThan(0);
      expect(meta.planFeatureKeys).toContain('maxStaff');
    }
  });

  it('declares every nav item with the permission it requires', () => {
    for (const key of SECTOR_KEYS) {
      for (const item of SECTOR_CATALOG[key].navItems) {
        expect(item.permission).toBeDefined();
        expect(item.titleKey).toMatch(/^ui\./);
      }
    }
  });
});
