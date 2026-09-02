import type { AppAccessControl } from '../../auth/access-control';

export const restaurantStatements = {
  table: ['manage'],
  kot: ['view', 'update'],
} as const;

export const restaurantOwnerGrants = {
  table: ['manage'],
  kot: ['view', 'update'],
} as const;

export const restaurantManagerGrants = {
  table: ['manage'],
  kot: ['view', 'update'],
} as const;

export function createRestaurantRoles(ac: AppAccessControl) {
  return {
    waiter: ac.newRole({
      order: ['create', 'confirm', 'serve'],
      table: ['manage'],
      kot: ['view'],
    }),
    chef: ac.newRole({ kot: ['view', 'update'] }),
  };
}
