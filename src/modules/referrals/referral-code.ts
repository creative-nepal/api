const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateReferralCode(
  random: () => number = Math.random,
): string {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }

  return code;
}

export function normaliseReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isWellFormedReferralCode(code: string): boolean {
  return (
    code.length === CODE_LENGTH &&
    [...code].every((character) => ALPHABET.includes(character))
  );
}
