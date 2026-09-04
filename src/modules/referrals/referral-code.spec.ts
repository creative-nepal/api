import {
  generateReferralCode,
  isWellFormedReferralCode,
  normaliseReferralCode,
} from './referral-code';

describe('generateReferralCode', () => {
  it('produces an eight character code from the unambiguous alphabet', () => {
    for (let run = 0; run < 200; run += 1) {
      expect(isWellFormedReferralCode(generateReferralCode())).toBe(true);
    }
  });

  it('never emits characters that are easy to misread aloud', () => {
    const seen = new Set<string>();

    for (let run = 0; run < 500; run += 1) {
      for (const character of generateReferralCode()) {
        seen.add(character);
      }
    }

    for (const character of ['0', 'O', '1', 'I', 'L']) {
      expect(seen.has(character)).toBe(false);
    }
  });
});

describe('normaliseReferralCode', () => {
  it('upper-cases and strips separators a customer might read out', () => {
    expect(normaliseReferralCode(' ab2-c4 d5e ')).toBe('AB2C4D5E');
  });

  it('rejects a code that is the right shape but uses banned characters', () => {
    expect(isWellFormedReferralCode(normaliseReferralCode('AB0C4D5E'))).toBe(
      false,
    );
  });
});
