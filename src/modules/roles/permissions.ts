import { roles as builtInRoles } from '../../auth/access-control';

export type PermissionMap = Record<string, string[]>;

export interface StoredRoleRow {
  role: string;
  permission: string | null;
}

function parse(raw: string | null): PermissionMap {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as PermissionMap)
      : {};
  } catch {
    return {};
  }
}

/**
 * Effective permissions for a role name, or a comma-separated list of them.
 * Pure so the guard can use it without pulling a service into DI, and so it
 * cannot drift from what the workspace shows the user.
 */
export function composePermissions(
  memberRole: string,
  stored: StoredRoleRow[],
): PermissionMap {
  const names = memberRole.split(',').map((part) => part.trim());
  const granted: PermissionMap = {};

  const add = (source: Record<string, readonly string[]>) => {
    for (const [resource, actions] of Object.entries(source)) {
      granted[resource] = [
        ...new Set([...(granted[resource] ?? []), ...actions]),
      ];
    }
  };

  for (const name of names) {
    const compiled = builtInRoles[name as keyof typeof builtInRoles];

    if (compiled) {
      add(compiled.statements);
    }

    const row = stored.find((entry) => entry.role === name);

    if (row) {
      add(parse(row.permission));
    }
  }

  return granted;
}

export function satisfies(
  granted: PermissionMap,
  required: Record<string, string[] | undefined>,
): boolean {
  return Object.entries(required).every(([resource, actions]) =>
    (actions ?? []).every((action) => granted[resource]?.includes(action)),
  );
}
