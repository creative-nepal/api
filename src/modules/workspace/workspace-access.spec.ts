import {
  navForSector,
  permissionsForRole,
  themeForSector,
} from './workspace-access';

function navKeys(sector: string, role: string): string[] {
  return navForSector(sector, permissionsForRole(role)).map((item) => item.key);
}

describe('permissionsForRole', () => {
  it('reports the statements a role actually carries', () => {
    const pharmacist = permissionsForRole('pharmacist');

    expect(pharmacist.dispense).toEqual(['prescription', 'controlled']);
    expect(pharmacist.invoice).toEqual(['issue', 'print']);
    expect(pharmacist.product).toBeUndefined();
  });

  it('grants nothing for an unknown role rather than defaulting open', () => {
    expect(permissionsForRole('ghost')).toEqual({});
  });

  it('unions the statements of a multi-role membership', () => {
    const both = permissionsForRole('cashier,chef');

    expect(both.invoice).toEqual(['issue', 'print']);
    expect(both.kot).toEqual(['view', 'update']);
  });
});

describe('navForSector', () => {
  it('gives an owner the sector nav followed by the kernel nav', () => {
    expect(navKeys('restaurant', 'owner')).toEqual([
      'tables',
      'kitchen',
      'menu',
      'products',
      'stock-takes',
      'reservations',
      'channels',
      'wastage',
      'purchasing',
      'customers',
      'cash',
      'expenses',
      'invoices',
      'branches',
      'staff',
      'settings',
    ]);
  });

  it('hides staff, settings and products from a cashier', () => {
    const keys = navKeys('mart', 'cashier');

    expect(keys).toEqual(['pos', 'customers', 'cash', 'invoices']);
  });

  it('gives a chef the kitchen board and wastage, nothing else', () => {
    expect(navForSector('restaurant', permissionsForRole('chef'))).toEqual([
      { key: 'kitchen', href: '/kitchen', titleKey: 'ui.web.nav.kitchen' },
      { key: 'wastage', href: '/wastage', titleKey: 'ui.web.nav.wastage' },
    ]);
  });

  it('scopes the nav to the business sector, not the role', () => {
    const keys = navKeys('medical', 'owner');

    expect(keys).toContain('batches');
    expect(keys).not.toContain('tables');
    expect(keys).not.toContain('kitchen');
  });

  it('returns nothing for an unknown sector and unknown role', () => {
    expect(navForSector('dental', permissionsForRole('ghost'))).toEqual([]);
  });
});

describe('themeForSector', () => {
  it('gives each sector its own palette', () => {
    const mart = themeForSector('mart', {});
    const medical = themeForSector('medical', {});

    expect(mart.primary).toBeDefined();
    expect(medical.primary).toBeDefined();
    expect(mart.primary).not.toEqual(medical.primary);
  });

  it('lets a business override the sector default', () => {
    const theme = themeForSector('restaurant', {
      primary: 'oklch(0.7 0.2 300)',
    });

    expect(theme.primary).toBe('oklch(0.7 0.2 300)');
  });

  it('keeps the sector default for keys the business did not set', () => {
    const base = themeForSector('medical', {});
    const overridden = themeForSector('medical', {
      primary: 'oklch(0.7 0.2 300)',
    });

    expect(overridden.radius).toBe(base.radius);
    expect(overridden.primaryForeground).toBe(base.primaryForeground);
  });

  it('carries through business-only keys the sector does not define', () => {
    const theme = themeForSector('mart', { logoUrl: '/logo.png' });

    expect(theme.logoUrl).toBe('/logo.png');
    expect(theme.primary).toBeDefined();
  });

  it('returns the business theme untouched for an unknown sector', () => {
    expect(themeForSector('nope', { primary: 'red' })).toEqual({
      primary: 'red',
    });
  });

  it('does not ship an accent, which would break dark-mode hovers', () => {
    // --accent is the hover background: light in light mode, dark in dark
    // mode. A single value forced on both makes one of them unreadable.
    expect(themeForSector('medical', {})).not.toHaveProperty('accent');
  });
});
