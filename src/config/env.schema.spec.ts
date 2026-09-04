import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/creative_nepal',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3333',
  INVITATION_ACCEPT_URL: 'http://localhost:3000/accept-invitation',
};

describe('validateEnv', () => {
  it('treats a blank LOG_LEVEL as unset, the way .env.example documents it', () => {
    expect(validateEnv({ ...base, LOG_LEVEL: '' }).LOG_LEVEL).toBeUndefined();
  });

  it('keeps a real LOG_LEVEL', () => {
    expect(validateEnv({ ...base, LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn');
  });

  it('still rejects a level that does not exist', () => {
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'chatty' })).toThrow();
  });
});
