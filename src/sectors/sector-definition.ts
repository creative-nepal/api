import type { Type } from '@nestjs/common';
import type { SectorKey } from '../database/schema/sector-keys';
import type { WorkspaceNavItem } from './nav';

export interface SectorMeta {
  key: SectorKey;
  nameKey: string;
  roleNames: string[];
  navItems: WorkspaceNavItem[];
  planFeatureKeys: string[];
}

export interface SectorDefinition extends SectorMeta {
  modules: Type<unknown>[];
}
