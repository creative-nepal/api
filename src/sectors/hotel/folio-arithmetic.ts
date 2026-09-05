export interface StayNights {
  nights: number;
  roomChargeCents: number;
}

const DAY_MS = 86_400_000;

export function nightsBetween(checkIn: string, checkOut: string): number {
  const from = Date.parse(`${checkIn}T00:00:00Z`);
  const to = Date.parse(`${checkOut}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error('Both dates must be YYYY-MM-DD');
  }

  return Math.round((to - from) / DAY_MS);
}

export function roomCharge(
  checkIn: string,
  checkOut: string,
  nightlyRateCents: number,
): StayNights {
  const nights = nightsBetween(checkIn, checkOut);

  return {
    nights,
    roomChargeCents: Math.max(0, nights) * nightlyRateCents,
  };
}

export function overlaps(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return aIn < bOut && bIn < aOut;
}
