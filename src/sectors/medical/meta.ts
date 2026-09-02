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
    key: 'batches',
    href: '/batches',
    titleKey: 'ui.web.nav.batches',
    permission: { product: ['update'] },
  },
];

export const medicalMeta: SectorMeta = {
  key: 'medical',
  nameKey: 'common.sector.medical',
  roleNames: ['pharmacist'],
  navItems,
  planFeatureKeys: [
    'maxStaff',
    'maxProducts',
    'maxInvoicesPerPeriod',
    'batchTracking',
  ],
};
