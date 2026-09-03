import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';
import type { SectorTheme } from '../theme';

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

const theme: SectorTheme = {
  primary: 'oklch(0.52 0.16 275)',
  primaryForeground: 'oklch(0.98 0.01 275)',
  radius: '0.625rem',
};

export const servicesMeta: SectorMeta = {
  key: 'services',
  nameKey: 'common.sector.services',
  roleNames: ['receptionist', 'practitioner'],
  navItems,
  theme,
  planFeatureKeys: [
    'maxStaff',
    'maxInvoicesPerPeriod',
    'maxAppointmentsPerMonth',
  ],
};
