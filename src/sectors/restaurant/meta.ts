import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';

const navItems: WorkspaceNavItem[] = [
  {
    key: 'tables',
    href: '/tables',
    titleKey: 'ui.web.nav.tables',
    permission: { table: ['manage'] },
  },
  {
    key: 'kitchen',
    href: '/kitchen',
    titleKey: 'ui.web.nav.kitchen',
    permission: { kot: ['view'] },
  },
  {
    key: 'menu',
    href: '/menu',
    titleKey: 'ui.web.nav.menu',
    permission: { product: ['create'] },
  },
  {
    key: 'products',
    href: '/products',
    titleKey: 'ui.web.nav.products',
    permission: { product: ['create'] },
  },
];

export const restaurantMeta: SectorMeta = {
  key: 'restaurant',
  nameKey: 'common.sector.restaurant',
  roleNames: ['waiter', 'chef'],
  navItems,
  planFeatureKeys: ['maxStaff', 'maxProducts', 'maxInvoicesPerPeriod'],
};
