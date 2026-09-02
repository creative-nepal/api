import type { Type } from '@nestjs/common';
import type { SectorKey } from '../database/schema/sector-keys';
import { parseEnabledSectorKeys, SECTOR_CATALOG } from './catalog';
import { martModules } from './mart/sector';
import { medicalModules } from './medical/sector';
import { restaurantModules } from './restaurant/sector';
import { servicesModules } from './services/sector';
import type { SectorDefinition } from './sector-definition';

export const SECTOR_REGISTRY: Record<SectorKey, SectorDefinition> = {
  mart: { ...SECTOR_CATALOG.mart, modules: martModules },
  medical: { ...SECTOR_CATALOG.medical, modules: medicalModules },
  restaurant: { ...SECTOR_CATALOG.restaurant, modules: restaurantModules },
  services: { ...SECTOR_CATALOG.services, modules: servicesModules },
};

export function enabledSectors(): SectorDefinition[] {
  return parseEnabledSectorKeys(process.env.SECTORS_ENABLED).map(
    (key) => SECTOR_REGISTRY[key],
  );
}

export function enabledSectorModules(): Type<unknown>[] {
  return [...new Set(enabledSectors().flatMap((sector) => sector.modules))];
}
