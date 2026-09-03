import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';

const navItems: WorkspaceNavItem[] = [
  {
    key: 'appointments',
    href: '/appointments',
    titleKey: 'ui.web.nav.appointments',
    permission: { appointment: ['complete'] },
  },
  {
    key: 'services',
    href: '/services',
    titleKey: 'ui.web.nav.services',
    permission: { membership: ['manage'] },
  },
  {
    key: 'availability',
    href: '/availability',
    titleKey: 'ui.web.nav.availability',
    permission: { membership: ['manage'] },
  },
  {
    key: 'pos',
    href: '/pos',
    titleKey: 'ui.web.nav.pos',
    permission: { order: ['create'] },
  },
];

export const servicesMeta: SectorMeta = {
  key: 'services',
  nameKey: 'common.sector.services',
  roleNames: ['receptionist', 'practitioner'],
  navItems,
  planFeatureKeys: [
    'maxStaff',
    'maxInvoicesPerPeriod',
    'maxAppointmentsPerMonth',
  ],
};
