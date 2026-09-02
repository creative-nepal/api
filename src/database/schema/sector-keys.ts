export const SECTOR_KEYS = [
  'mart',
  'medical',
  'restaurant',
  'services',
] as const;

export type SectorKey = (typeof SECTOR_KEYS)[number];

export function isSectorKey(value: string): value is SectorKey {
  return (SECTOR_KEYS as readonly string[]).includes(value);
}
