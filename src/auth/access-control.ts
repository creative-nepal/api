import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements as adminDefaultStatements,
  userAc as platformUserAc,
} from 'better-auth/plugins/admin/access';
import {
  adminAc as orgAdminAc,
  defaultStatements,
  memberAc as orgMemberAc,
} from 'better-auth/plugins/organization/access';

export const statement = {
  ...defaultStatements,
  business: ['manage'],
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve'],
  invoice: ['issue', 'print', 'credit-note'],
  dispense: ['prescription', 'controlled'],
  table: ['manage'],
  kot: ['view', 'update'],
} as const;

export const ac = createAccessControl(statement);

export const ownerRole = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
  business: ['manage'],
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve'],
  invoice: ['issue', 'print', 'credit-note'],
  dispense: ['prescription', 'controlled'],
  table: ['manage'],
  kot: ['view', 'update'],
});

export const managerRole = ac.newRole({
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve'],
  invoice: ['issue', 'print', 'credit-note'],
  table: ['manage'],
  kot: ['view', 'update'],
});

export const cashierRole = ac.newRole({
  order: ['create'],
  invoice: ['issue', 'print'],
});

export const pharmacistRole = ac.newRole({
  order: ['create'],
  invoice: ['issue', 'print'],
  dispense: ['prescription', 'controlled'],
});

export const waiterRole = ac.newRole({
  order: ['create', 'confirm', 'serve'],
  table: ['manage'],
  kot: ['view'],
});

export const chefRole = ac.newRole({ kot: ['view', 'update'] });

export const roles = {
  admin: orgAdminAc,
  member: orgMemberAc,
  owner: ownerRole,
  manager: managerRole,
  cashier: cashierRole,
  pharmacist: pharmacistRole,
  waiter: waiterRole,
  chef: chefRole,
};

export type OrgRoleName = keyof typeof roles;

export type OrgPermissionRequest = {
  [K in keyof typeof statement]?: Array<(typeof statement)[K][number]>;
};

export const platformStatement = {
  ...adminDefaultStatements,
  business: ['list-all', 'suspend', 'close', 'view-any', 'set-compliance'],
  plan: ['create', 'update', 'archive'],
  subscription: ['assign', 'cancel', 'view-any'],
  audit: ['view-all'],
  content: ['create', 'update', 'publish', 'delete'],
} as const;

export const platformAc = createAccessControl(platformStatement);

export const superAdminRole = platformAc.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
  business: ['list-all', 'suspend', 'close', 'view-any', 'set-compliance'],
  plan: ['create', 'update', 'archive'],
  subscription: ['assign', 'cancel', 'view-any'],
  audit: ['view-all'],
  content: ['create', 'update', 'publish', 'delete'],
});

export const platformRoles = {
  admin: superAdminRole,
  user: platformUserAc,
};

export type PlatformPermissionRequest = {
  [K in keyof typeof platformStatement]?: Array<
    (typeof platformStatement)[K][number]
  >;
};
