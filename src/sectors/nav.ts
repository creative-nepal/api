import type { OrgPermissionRequest } from '../auth/access-control';

export const NAV_GROUPS = ['counter', 'stock', 'money', 'setup'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export interface WorkspaceNavItem {
  key: string;
  group: NavGroup;
  href: string;
  titleKey: string;
  permission?: OrgPermissionRequest;
}

export const KERNEL_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    key: 'purchasing',
    group: 'stock',
    href: '/purchasing',
    titleKey: 'ui.web.nav.purchasing',
    permission: { product: ['update'] },
  },
  {
    key: 'calendar',
    group: 'counter',
    href: '/calendar',
    titleKey: 'ui.web.nav.calendar',
    permission: { calendar: ['view'] },
  },
  {
    key: 'customers',
    group: 'money',
    href: '/customers',
    titleKey: 'ui.web.nav.customers',
    permission: { order: ['create'] },
  },
  {
    key: 'cash',
    group: 'money',
    href: '/cash',
    titleKey: 'ui.web.nav.cash',
    permission: { cash: ['view'] },
  },
  {
    key: 'expenses',
    group: 'money',
    href: '/expenses',
    titleKey: 'ui.web.nav.expenses',
    permission: { expense: ['view'] },
  },
  {
    key: 'production',
    group: 'stock',
    href: '/production',
    titleKey: 'ui.web.nav.production',
    permission: { production: ['view'] },
  },
  {
    key: 'reports',
    group: 'money',
    href: '/reports',
    titleKey: 'ui.web.nav.reports',
    permission: { report: ['view'] },
  },
  {
    key: 'invoices',
    group: 'money',
    href: '/invoices',
    titleKey: 'ui.web.nav.invoices',
    permission: { invoice: ['print'] },
  },
  {
    key: 'branches',
    group: 'setup',
    href: '/branches',
    titleKey: 'ui.web.nav.branches',
    permission: { business: ['manage'] },
  },
  {
    key: 'staff',
    group: 'setup',
    href: '/staff',
    titleKey: 'ui.web.nav.staff',
    permission: { member: ['create'] },
  },
  {
    key: 'settings',
    group: 'setup',
    href: '/settings',
    titleKey: 'ui.web.nav.settings',
    permission: { business: ['manage'] },
  },
];
