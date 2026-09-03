import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';

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
];

export const martMeta: SectorMeta = {
  key: 'mart',
  nameKey: 'common.sector.mart',
  roleNames: [],
  navItems,
  planFeatureKeys: ['maxStaff', 'maxProducts', 'maxInvoicesPerPeriod'],
};
