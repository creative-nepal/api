import { composePermissions, satisfies } from './permissions';

describe('composePermissions', () => {
  it('resolves a built-in role', () => {
    const granted = composePermissions('cashier', []);

    expect(granted.order).toContain('create');
    expect(granted.invoice).toContain('issue');
  });

  it('does not grant a built-in role more than it has', () => {
    const granted = composePermissions('cashier', []);

    expect(granted.order).not.toContain('discount');
    expect(granted.product ?? []).not.toContain('update');
  });

  it('unions a comma-separated list of roles', () => {
    const granted = composePermissions('cashier,chef', []);

    expect(granted.order).toContain('create');
    expect(granted.kot).toContain('update');
  });

  it('adds a stored dynamic role on top of the built-ins', () => {
    const granted = composePermissions('stock-clerk', [
      { role: 'stock-clerk', permission: '{"product":["update"]}' },
    ]);

    expect(granted.product).toEqual(['update']);
  });

  it('merges a stored role that extends a built-in of the same name', () => {
    const granted = composePermissions('cashier', [
      { role: 'cashier', permission: '{"order":["discount"]}' },
    ]);

    expect(granted.order).toContain('create');
    expect(granted.order).toContain('discount');
  });

  it('ignores an unknown role rather than throwing', () => {
    expect(composePermissions('nope', [])).toEqual({});
  });

  it('survives malformed stored permission json', () => {
    expect(
      composePermissions('broken', [{ role: 'broken', permission: '{oops' }]),
    ).toEqual({});
  });

  it('survives a null stored permission', () => {
    expect(
      composePermissions('empty', [{ role: 'empty', permission: null }]),
    ).toEqual({});
  });
});

describe('satisfies', () => {
  const granted = { order: ['create', 'discount'], invoice: ['print'] };

  it('passes when every required action is granted', () => {
    expect(satisfies(granted, { order: ['create'] })).toBe(true);
  });

  it('passes when several resources are all granted', () => {
    expect(satisfies(granted, { order: ['create'], invoice: ['print'] })).toBe(
      true,
    );
  });

  it('fails when one action of many is missing', () => {
    expect(satisfies(granted, { order: ['create', 'refund'] })).toBe(false);
  });

  it('fails when the resource is absent entirely', () => {
    expect(satisfies(granted, { product: ['update'] })).toBe(false);
  });

  it('passes an empty requirement', () => {
    expect(satisfies(granted, {})).toBe(true);
  });
});
