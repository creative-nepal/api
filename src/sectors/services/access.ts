import type { AppAccessControl } from '../../auth/access-control';

export const servicesStatements = {
  appointment: ['book', 'complete', 'cancel'],
  membership: ['manage'],
} as const;

export const servicesOwnerGrants = {
  appointment: ['book', 'complete', 'cancel'],
  membership: ['manage'],
} as const;

export const servicesManagerGrants = {
  appointment: ['book', 'complete', 'cancel'],
  membership: ['manage'],
} as const;

export function createServicesRoles(ac: AppAccessControl) {
  return {
    receptionist: ac.newRole({
      order: ['create'],
      invoice: ['issue', 'print'],
      appointment: ['book', 'cancel'],
      membership: ['manage'],
    }),
    practitioner: ac.newRole({
      appointment: ['complete'],
    }),
  };
}
