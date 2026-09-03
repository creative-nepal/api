export interface SectorTheme {
  primary: string;
  primaryForeground: string;
  radius: string;
}

export function mergeSectorTheme(
  sectorTheme: SectorTheme,
  businessTheme: Record<string, unknown>,
): Record<string, unknown> {
  return { ...sectorTheme, ...businessTheme };
}
