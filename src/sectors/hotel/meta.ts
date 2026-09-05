import type { WorkspaceNavItem } from '../nav';
import type { SectorMeta } from '../sector-definition';
import type { SectorTheme } from '../theme';

const navItems: WorkspaceNavItem[] = [
  {
    key: 'front-desk',
    href: '/front-desk',
    titleKey: 'ui.web.nav.frontDesk',
    permission: { booking: ['book'] },
  },
  {
    key: 'rooms',
    href: '/rooms',
    titleKey: 'ui.web.nav.rooms',
    permission: { room: ['manage'] },
  },
  {
    key: 'housekeeping',
    href: '/housekeeping',
    titleKey: 'ui.web.nav.housekeeping',
    permission: { housekeeping: ['view'] },
  },
  {
    key: 'pos',
    href: '/pos',
    titleKey: 'ui.web.nav.pos',
    permission: { order: ['create'] },
  },
];

const theme: SectorTheme = {
  primary: 'oklch(0.48 0.09 210)',
  primaryForeground: 'oklch(0.98 0.01 210)',
  radius: '0.5rem',
};

export const hotelMeta: SectorMeta = {
  key: 'hotel',
  nameKey: 'common.sector.hotel',
  roleNames: ['frontDesk', 'housekeeper'],
  navItems,
  theme,
  planFeatureKeys: ['maxStaff', 'maxInvoicesPerPeriod', 'maxRooms'],
};
