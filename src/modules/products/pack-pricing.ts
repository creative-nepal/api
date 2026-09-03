export function subUnitPriceCents(
  packPriceCents: number,
  unitsPerPack: number,
): number {
  if (unitsPerPack <= 1) {
    return packPriceCents;
  }

  return Math.round(packPriceCents / unitsPerPack);
}

export function lineTotalForSubUnits(
  packPriceCents: number,
  unitsPerPack: number,
  subUnits: number,
): number {
  if (unitsPerPack <= 1) {
    return Math.round(packPriceCents * subUnits);
  }

  return Math.round((packPriceCents * subUnits) / unitsPerPack);
}

export function describePackStock(
  subUnits: number,
  unitsPerPack: number,
): { packs: number; loose: number } {
  if (unitsPerPack <= 1) {
    return { packs: subUnits, loose: 0 };
  }

  return {
    packs: Math.floor(subUnits / unitsPerPack),
    loose: subUnits % unitsPerPack,
  };
}
