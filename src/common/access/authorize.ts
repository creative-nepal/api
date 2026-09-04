import { roles as builtInRoles } from '../../auth/access-control';
import type { StoredRoleRow } from '../../modules/roles/permissions';

function parse(raw: string | null): Record<string, string[]> {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, string[]>)
      : {};
  } catch {
    return {};
  }
}

function statementsFor(
  role: string,
  stored: StoredRoleRow[],
): Record<string, string[]> {
  const compiled = builtInRoles[role as keyof typeof builtInRoles];

  const merged: Record<string, string[]> = compiled
    ? Object.fromEntries(
        Object.entries(
          compiled.statements as Record<string, readonly string[]>,
        ).map(([resource, actions]) => [resource, [...actions]]),
      )
    : {};

  const row = stored.find((entry) => entry.role === role);

  if (row) {
    for (const [resource, actions] of Object.entries(parse(row.permission))) {
      merged[resource] = [
        ...new Set([...(merged[resource] ?? []), ...actions]),
      ];
    }
  }

  return merged;
}

export function authorizes(
  memberRole: string,
  stored: StoredRoleRow[],
  required: Record<string, string[] | undefined>,
): boolean {
  const entries = Object.entries(required);

  if (entries.length === 0) {
    return false;
  }

  return memberRole
    .split(',')
    .map((part) => part.trim())
    .some((role) => {
      const granted = statementsFor(role, stored);

      return entries.every(([resource, actions]) =>
        (actions ?? []).every((action) => granted[resource]?.includes(action)),
      );
    });
}
