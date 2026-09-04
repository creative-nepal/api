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
    key: 'claims',
    href: '/claims',
    titleKey: 'ui.web.nav.claims',
    permission: { invoice: ['print'] },
  },
  {
    key: 'batches',
    href: '/batches',
    titleKey: 'ui.web.nav.batches',
    permission: { product: ['update'] },
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
  primary: 'oklch(0.55 0.13 160)',
  primaryForeground: 'oklch(0.98 0.01 160)',
  radius: '0.375rem',
};

export const medicalMeta: SectorMeta = {
  key: 'medical',
  nameKey: 'common.sector.medical',
  roleNames: ['pharmacist'],
  navItems,
  theme,
  planFeatureKeys: [
    'maxStaff',
    'maxProducts',
    'maxInvoicesPerPeriod',
    'batchTracking',
  ],
};
