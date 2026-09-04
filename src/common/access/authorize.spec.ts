import { authorizes } from './authorize';

describe('authorizes', () => {
  it('allows a built-in role its own permission', () => {
    expect(authorizes('cashier', [], { order: ['create'] })).toBe(true);
  });

  it('denies a permission the role does not hold', () => {
    expect(authorizes('cashier', [], { order: ['discount'] })).toBe(false);
  });

  it('denies an unknown role everything', () => {
    expect(authorizes('nobody', [], { order: ['create'] })).toBe(false);
  });

  it('denies an empty requirement, matching Better Auth', () => {
    expect(authorizes('owner', [], {})).toBe(false);
  });

  it('requires every action of a resource, not just one', () => {
    expect(authorizes('cashier', [], { order: ['create', 'refund'] })).toBe(
      false,
    );
  });

  describe('multiple roles are an OR, never a union', () => {
    it('passes when one role satisfies the whole request', () => {
      expect(authorizes('cashier,chef', [], { order: ['create'] })).toBe(true);
    });

    it('passes on the second role when the first cannot', () => {
      expect(authorizes('cashier,chef', [], { kot: ['update'] })).toBe(true);
    });

    it('denies a request that only the union of both roles could satisfy', () => {
      expect(
        authorizes('cashier,chef', [], {
          order: ['create'],
          kot: ['update'],
        }),
      ).toBe(false);
    });

    it('tolerates whitespace around role names', () => {
      expect(authorizes(' cashier , chef ', [], { kot: ['update'] })).toBe(
        true,
      );
    });
  });

  describe('dynamic roles', () => {
    const stored = [
      { role: 'stock-clerk', permission: '{"product":["update"]}' },
    ];

    it('allows a permission granted only by a stored role', () => {
      expect(authorizes('stock-clerk', stored, { product: ['update'] })).toBe(
        true,
      );
    });

    it('merges a stored role into the built-in of the same name', () => {
      const extended = [
        { role: 'cashier', permission: '{"order":["discount"]}' },
      ];

      expect(authorizes('cashier', extended, { order: ['create'] })).toBe(true);
      expect(authorizes('cashier', extended, { order: ['discount'] })).toBe(
        true,
      );
    });

    it('ignores malformed stored json rather than throwing', () => {
      expect(
        authorizes('broken', [{ role: 'broken', permission: '{oops' }], {
          order: ['create'],
        }),
      ).toBe(false);
    });

    it('ignores a null stored permission', () => {
      expect(
        authorizes('empty', [{ role: 'empty', permission: null }], {
          order: ['create'],
        }),
      ).toBe(false);
    });
  });

  it('gives an owner the broad grants it is configured with', () => {
    expect(authorizes('owner', [], { business: ['manage'] })).toBe(true);
    expect(authorizes('owner', [], { order: ['discount'] })).toBe(true);
  });
});
