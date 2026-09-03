import {
  type OrgPermissionRequest,
  type OrgRoleName,
  roles,
} from '../../auth/access-control';
import type { SectorKey } from '../../database/schema/sector-keys';
import { SECTOR_CATALOG } from '../../sectors/catalog';
import { mergeSectorTheme } from '../../sectors/theme';
import { KERNEL_NAV_ITEMS, type WorkspaceNavItem } from '../../sectors/nav';

export type EffectivePermissions = Record<string, string[]>;

export interface WorkspaceNavItemView {
  key: string;
  href: string;
  titleKey: string;
}

export function permissionsForRole(role: string): EffectivePermissions {
  const granted: EffectivePermissions = {};

  for (const name of role.split(',').map((part) => part.trim())) {
    const definition = roles[name as OrgRoleName];

    if (!definition) {
      continue;
    }

    for (const [resource, actions] of Object.entries(
      definition.statements as Record<string, readonly string[]>,
    )) {
      granted[resource] = [
        ...new Set([...(granted[resource] ?? []), ...actions]),
      ];
    }
  }

  return granted;
}

export function isAllowed(
  granted: EffectivePermissions,
  required: OrgPermissionRequest | undefined,
): boolean {
  if (!required) {
    return true;
  }

  return Object.entries(required).every(([resource, actions]) =>
    (actions ?? []).every((action) => granted[resource]?.includes(action)),
  );
}

export function themeForSector(
  sector: string,
  businessTheme: Record<string, unknown>,
): Record<string, unknown> {
  const sectorTheme = SECTOR_CATALOG[sector as SectorKey]?.theme;

  if (!sectorTheme) {
    return businessTheme;
  }

  return mergeSectorTheme(sectorTheme, businessTheme);
}

export function navForSector(
  sector: string,
  granted: EffectivePermissions,
): WorkspaceNavItemView[] {
  const items: WorkspaceNavItem[] = [
    ...(SECTOR_CATALOG[sector as SectorKey]?.navItems ?? []),
    ...KERNEL_NAV_ITEMS,
  ];

  return items
    .filter((item) => isAllowed(granted, item.permission))
    .map(({ key, href, titleKey }) => ({ key, href, titleKey }));
}
