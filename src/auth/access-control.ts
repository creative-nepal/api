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
import {
  createMartRoles,
  martManagerGrants,
  martOwnerGrants,
  martStatements,
} from '../sectors/mart/access';
import {
  createMedicalRoles,
  medicalManagerGrants,
  medicalOwnerGrants,
  medicalStatements,
} from '../sectors/medical/access';
import {
  createServicesRoles,
  servicesManagerGrants,
  servicesOwnerGrants,
  servicesStatements,
} from '../sectors/services/access';
import {
  createHotelRoles,
  hotelManagerGrants,
  hotelOwnerGrants,
  hotelStatements,
} from '../sectors/hotel/access';
import {
  createRestaurantRoles,
  restaurantManagerGrants,
  restaurantOwnerGrants,
  restaurantStatements,
} from '../sectors/restaurant/access';

const kernelStatements = {
  business: ['manage'],
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve', 'discount'],
  invoice: ['issue', 'print', 'credit-note'],
  stocktake: ['open', 'count', 'complete'],
  cash: ['view', 'open', 'close', 'move', 'take-payment'],
  wastage: ['view', 'record'],
  expense: ['view', 'record'],
  calendar: ['view', 'manage'],
  report: ['view'],
  production: ['view', 'plan', 'record'],
} as const;

export const statement = {
  ...defaultStatements,
  ...kernelStatements,
  ...martStatements,
  ...medicalStatements,
  ...restaurantStatements,
  ...servicesStatements,
  ...hotelStatements,
} as const;

export const ac = createAccessControl(statement);

export type AppAccessControl = typeof ac;

export const ownerRole = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
  business: ['manage'],
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve', 'discount'],
  invoice: ['issue', 'print', 'credit-note'],
  stocktake: ['open', 'count', 'complete'],
  cash: ['view', 'open', 'close', 'move', 'take-payment'],
  wastage: ['view', 'record'],
  expense: ['view', 'record'],
  calendar: ['view', 'manage'],
  report: ['view'],
  production: ['view', 'plan', 'record'],
  ...martOwnerGrants,
  ...medicalOwnerGrants,
  ...restaurantOwnerGrants,
  ...servicesOwnerGrants,
  ...hotelOwnerGrants,
});

export const managerRole = ac.newRole({
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund', 'confirm', 'serve', 'discount'],
  invoice: ['issue', 'print', 'credit-note'],
  stocktake: ['open', 'count', 'complete'],
  cash: ['view', 'open', 'close', 'move', 'take-payment'],
  wastage: ['view', 'record'],
  expense: ['view', 'record'],
  calendar: ['view', 'manage'],
  report: ['view'],
  production: ['view', 'plan', 'record'],
  ...martManagerGrants,
  ...medicalManagerGrants,
  ...restaurantManagerGrants,
  ...servicesManagerGrants,
  ...hotelManagerGrants,
});

export const cashierRole = ac.newRole({
  order: ['create'],
  invoice: ['issue', 'print'],
  cash: ['view', 'open', 'close', 'move', 'take-payment'],
  calendar: ['view'],
  report: ['view'],
});

const sectorRoles = {
  ...createMartRoles(),
  ...createMedicalRoles(ac),
  ...createRestaurantRoles(ac),
  ...createServicesRoles(ac),
  ...createHotelRoles(ac),
};

export const pharmacistRole = sectorRoles.pharmacist;
export const waiterRole = sectorRoles.waiter;
export const chefRole = sectorRoles.chef;

export const roles = {
  admin: orgAdminAc,
  member: orgMemberAc,
  owner: ownerRole,
  manager: managerRole,
  cashier: cashierRole,
  ...sectorRoles,
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
