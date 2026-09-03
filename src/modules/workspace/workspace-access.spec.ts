import { navForSector, permissionsForRole } from './workspace-access';

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
      'purchasing',
      'customers',
      'invoices',
      'branches',
      'staff',
      'settings',
    ]);
  });

  it('hides staff, settings and products from a cashier', () => {
    const keys = navKeys('mart', 'cashier');

    expect(keys).toEqual(['pos', 'customers', 'invoices']);
  });

  it('gives a chef only the kitchen board', () => {
    expect(navForSector('restaurant', permissionsForRole('chef'))).toEqual([
      { key: 'kitchen', href: '/kitchen', titleKey: 'ui.web.nav.kitchen' },
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
