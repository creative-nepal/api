const DEFAULT_BRAND_NAME = 'Creative Nepal';

export function brandName(): string {
  return process.env.BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

export function defaultEmailFrom(): string {
  return `${brandName()} <onboarding@resend.dev>`;
}
