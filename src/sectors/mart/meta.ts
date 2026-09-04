import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';
import type { SectorTheme } from '../theme';

const navItems: WorkspaceNavItem[] = [
  {
    key: 'pos',
    href: '/pos',
    titleKey: 'ui.web.nav.pos',
    permission: { order: ['create'] },
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
    key: 'wastage',
    href: '/wastage',
    titleKey: 'ui.web.nav.wastage',
    permission: { wastage: ['view'] },
  },
];

const theme: SectorTheme = {
  primary: 'oklch(0.62 0.15 65)',
  primaryForeground: 'oklch(0.98 0.01 65)',
  radius: '0.5rem',
};

export const martMeta: SectorMeta = {
  key: 'mart',
  nameKey: 'common.sector.mart',
  roleNames: [],
  navItems,
  theme,
  planFeatureKeys: ['maxStaff', 'maxProducts', 'maxInvoicesPerPeriod'],
};
