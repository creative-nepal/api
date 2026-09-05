import {
  isSectorKey,
  SECTOR_KEYS,
  type SectorKey,
} from '../database/schema/sector-keys';
import { hotelMeta } from './hotel/meta';
import { martMeta } from './mart/meta';
import { medicalMeta } from './medical/meta';
import { restaurantMeta } from './restaurant/meta';
import { servicesMeta } from './services/meta';
import type { SectorMeta } from './sector-definition';

export const SECTOR_CATALOG: Record<SectorKey, SectorMeta> = {
  mart: martMeta,
  medical: medicalMeta,
  restaurant: restaurantMeta,
  services: servicesMeta,
  hotel: hotelMeta,
};

export function parseEnabledSectorKeys(raw: string | undefined): SectorKey[] {
  const value = raw?.trim();

  if (!value) {
    return [...SECTOR_KEYS];
  }

  const keys = value
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  const unknown = keys.filter((key) => !isSectorKey(key));

  if (unknown.length > 0) {
    throw new Error(
      `SECTORS_ENABLED contains unknown sector key(s): ${unknown.join(', ')}. Known: ${SECTOR_KEYS.join(', ')}`,
    );
  }

  return [...new Set(keys as SectorKey[])];
}

export function enabledSectorMeta(raw?: string): SectorMeta[] {
  return parseEnabledSectorKeys(raw ?? process.env.SECTORS_ENABLED).map(
    (key) => SECTOR_CATALOG[key],
  );
}
