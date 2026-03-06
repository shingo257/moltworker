import { describe, it, expect } from 'vitest';
import { buildSandboxOptions, validateRequiredEnv } from './config';
import { createMockEnv } from './test-utils';

describe('validateRequiredEnv', () => {
  it('returns MOLTBOT_GATEWAY_TOKEN when missing (non-dev)', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-key',
      CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      CF_ACCESS_AUD: 'aud-123',
    });
    const missing = validateRequiredEnv(env);
    expect(missing).toContain('MOLTBOT_GATEWAY_TOKEN');
  });

  it('returns empty when all required are set (non-dev)', () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'token',
      ANTHROPIC_API_KEY: 'sk-key',
      CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      CF_ACCESS_AUD: 'aud-123',
    });
    const missing = validateRequiredEnv(env);
    expect(missing).toEqual([]);
  });

  it('skips CF Access vars in dev mode', () => {
    const env = createMockEnv({
      DEV_MODE: 'true',
      MOLTBOT_GATEWAY_TOKEN: 'token',
      ANTHROPIC_API_KEY: 'sk-key',
    });
    const missing = validateRequiredEnv(env);
    expect(missing).toEqual([]);
  });

  it('returns AI provider hint when no provider is set', () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'token',
      CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      CF_ACCESS_AUD: 'aud-123',
    });
    const missing = validateRequiredEnv(env);
    expect(missing.some((m) => m.includes('ANTHROPIC_API_KEY'))).toBe(true);
  });

  it('accepts OpenAI key as provider', () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'token',
      OPENAI_API_KEY: 'sk-openai',
      CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      CF_ACCESS_AUD: 'aud-123',
    });
    const missing = validateRequiredEnv(env);
    expect(missing).toEqual([]);
  });
});

describe('buildSandboxOptions', () => {
  it('returns keepAlive: true when SANDBOX_SLEEP_AFTER is "never"', () => {
    const env = createMockEnv({ SANDBOX_SLEEP_AFTER: 'never' });
    const opts = buildSandboxOptions(env);
    expect(opts).toEqual({ keepAlive: true });
  });

  it('returns keepAlive: true when SANDBOX_SLEEP_AFTER is undefined', () => {
    const env = createMockEnv();
    const opts = buildSandboxOptions(env);
    expect(opts).toEqual({ keepAlive: true });
  });

  it('returns sleepAfter duration when set', () => {
    const env = createMockEnv({ SANDBOX_SLEEP_AFTER: '10m' });
    const opts = buildSandboxOptions(env);
    expect(opts).toEqual({ sleepAfter: '10m' });
  });

  it('normalizes sleepAfter to lowercase', () => {
    const env = createMockEnv({ SANDBOX_SLEEP_AFTER: '1H' });
    const opts = buildSandboxOptions(env);
    expect(opts).toEqual({ sleepAfter: '1h' });
  });
});
