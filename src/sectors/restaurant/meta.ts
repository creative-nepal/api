import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';
import type { SectorTheme } from '../theme';

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
  {
    key: 'stock-takes',
    href: '/stock-takes',
    titleKey: 'ui.web.nav.stockTakes',
    permission: { stocktake: ['count'] },
  },
  {
    key: 'reservations',
    href: '/reservations',
    titleKey: 'ui.web.nav.reservations',
    permission: { reservation: ['view'] },
  },
];

const theme: SectorTheme = {
  primary: 'oklch(0.55 0.19 25)',
  primaryForeground: 'oklch(0.98 0.01 25)',
  radius: '0.75rem',
};

export const restaurantMeta: SectorMeta = {
  key: 'restaurant',
  nameKey: 'common.sector.restaurant',
  roleNames: ['waiter', 'chef'],
  navItems,
  theme,
  planFeatureKeys: ['maxStaff', 'maxProducts', 'maxInvoicesPerPeriod'],
};
