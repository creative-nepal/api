import type { AppAccessControl } from '../../auth/access-control';

export const medicalStatements = {
  dispense: ['prescription', 'controlled'],
  recall: ['view', 'quarantine'],
} as const;

export const medicalOwnerGrants = {
  dispense: ['prescription', 'controlled'],
  recall: ['view', 'quarantine'],
} as const;

export const medicalManagerGrants = {
  recall: ['view', 'quarantine'],
} as const;

export function createMedicalRoles(ac: AppAccessControl) {
  return {
    pharmacist: ac.newRole({
      order: ['create'],
      invoice: ['issue', 'print'],
      dispense: ['prescription', 'controlled'],
      recall: ['view'],
    }),
  };
}
