import type { AppAccessControl } from '../../auth/access-control';

export const hotelStatements = {
  room: ['manage'],
  booking: ['book', 'check-in', 'check-out', 'cancel'],
  folio: ['post', 'settle'],
  housekeeping: ['view', 'update'],
} as const;

export const hotelOwnerGrants = {
  room: ['manage'],
  booking: ['book', 'check-in', 'check-out', 'cancel'],
  folio: ['post', 'settle'],
  housekeeping: ['view', 'update'],
} as const;

export const hotelManagerGrants = {
  room: ['manage'],
  booking: ['book', 'check-in', 'check-out', 'cancel'],
  folio: ['post', 'settle'],
  housekeeping: ['view', 'update'],
} as const;

export function createHotelRoles(ac: AppAccessControl) {
  return {
    frontDesk: ac.newRole({
      order: ['create'],
      invoice: ['issue', 'print'],
      booking: ['book', 'check-in', 'check-out', 'cancel'],
      folio: ['post', 'settle'],
      housekeeping: ['view'],
      calendar: ['view'],
    }),
    housekeeper: ac.newRole({
      housekeeping: ['view', 'update'],
    }),
  };
}
