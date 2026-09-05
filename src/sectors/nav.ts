import type { OrgPermissionRequest } from '../auth/access-control';

export interface WorkspaceNavItem {
  key: string;
  href: string;
  titleKey: string;
  permission?: OrgPermissionRequest;
}

export const KERNEL_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    key: 'purchasing',
    href: '/purchasing',
    titleKey: 'ui.web.nav.purchasing',
    permission: { product: ['update'] },
  },
  {
    key: 'calendar',
    href: '/calendar',
    titleKey: 'ui.web.nav.calendar',
    permission: { calendar: ['view'] },
  },
  {
    key: 'customers',
    href: '/customers',
    titleKey: 'ui.web.nav.customers',
    permission: { order: ['create'] },
  },
  {
    key: 'cash',
    href: '/cash',
    titleKey: 'ui.web.nav.cash',
    permission: { cash: ['view'] },
  },
  {
    key: 'expenses',
    href: '/expenses',
    titleKey: 'ui.web.nav.expenses',
    permission: { expense: ['view'] },
  },
  {
    key: 'production',
    href: '/production',
    titleKey: 'ui.web.nav.production',
    permission: { production: ['view'] },
  },
  {
    key: 'reports',
    href: '/reports',
    titleKey: 'ui.web.nav.reports',
    permission: { report: ['view'] },
  },
  {
    key: 'invoices',
    href: '/invoices',
    titleKey: 'ui.web.nav.invoices',
    permission: { invoice: ['print'] },
  },
  {
    key: 'branches',
    href: '/branches',
    titleKey: 'ui.web.nav.branches',
    permission: { business: ['manage'] },
  },
  {
    key: 'staff',
    href: '/staff',
    titleKey: 'ui.web.nav.staff',
    permission: { member: ['create'] },
  },
  {
    key: 'settings',
    href: '/settings',
    titleKey: 'ui.web.nav.settings',
    permission: { business: ['manage'] },
  },
];
