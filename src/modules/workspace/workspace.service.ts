import { Injectable } from '@nestjs/common';
import type { Business, Member } from '../../database/schema';
import { RolesService } from '../roles/roles.service';
import {
  type EffectivePermissions,
  navForSector,
  type WorkspaceNavItemView,
} from './workspace-access';

export interface WorkspaceBranding {
  displayName: string;
  theme: Record<string, unknown>;
}

export interface WorkspaceView {
  business: Business;
  branding: WorkspaceBranding;
  membership: { role: string };
  permissions: EffectivePermissions;
  nav: WorkspaceNavItemView[];
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly rolesService: RolesService) {}

  async resolve(
    business: Business,
    membership: Member,
  ): Promise<WorkspaceView> {
    const permissions = await this.rolesService.permissionsFor(
      business.organizationId,
      membership.role,
    );

    return {
      business,
      branding: {
        displayName: business.displayName ?? business.legalName,
        theme: business.theme ?? {},
      },
      membership: { role: membership.role },
      permissions,
      nav: navForSector(business.sector, permissions),
    };
  }
}
