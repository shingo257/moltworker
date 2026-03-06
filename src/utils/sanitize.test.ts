import { describe, it, expect } from 'vitest';
import { sanitizeStderr } from './sanitize';

describe('sanitizeStderr', () => {
  it('returns empty string for empty string', () => {
    expect(sanitizeStderr('')).toBe('');
  });

  it('returns empty string for null-like input (falsy)', () => {
    expect(sanitizeStderr(null as unknown as string)).toBe('');
    expect(sanitizeStderr(undefined as unknown as string)).toBe('');
  });

  it('redacts sk-ant- API keys', () => {
    const input = 'Error: Invalid key sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456';
    expect(sanitizeStderr(input)).toBe('Error: Invalid key sk-ant-***REDACTED***');
  });

  it('redacts xoxb- Slack bot tokens', () => {
    const input = 'token=xoxb-12345-abcdef-ghijkl';
    expect(sanitizeStderr(input)).toBe('token=xoxb-***REDACTED***');
  });

  it('redacts xoxp- Slack app tokens', () => {
    const input = 'xoxp-98765-zyxwvu-tsrqpo';
    expect(sanitizeStderr(input)).toBe('xoxp-***REDACTED***');
  });

  it('truncates to maxLen and appends ...', () => {
    const long = 'a'.repeat(600);
    const result = sanitizeStderr(long, 100);
    expect(result.length).toBe(103);
    expect(result.endsWith('...')).toBe(true);
    expect(result.slice(0, 100)).toBe('a'.repeat(100));
  });

  it('leaves plain text unchanged when under maxLen', () => {
    const plain = 'Some error message without secrets';
    expect(sanitizeStderr(plain)).toBe(plain);
  });

  it('uses default maxLen of 500 when not provided', () => {
    const long = 'x'.repeat(600);
    const result = sanitizeStderr(long);
    expect(result.length).toBe(503);
    expect(result.endsWith('...')).toBe(true);
  });

  it('redacts secret when present and truncates if total length exceeds maxLen', () => {
    const withSecret = 'key=' + 'sk-ant-api03-' + 'a'.repeat(30) + ' tail';
    const result = sanitizeStderr(withSecret, 30);
    expect(result).toContain('sk-ant-***REDACTED***');
    expect(result).not.toContain('aaaaaaaaaa');
    expect(result.length).toBeLessThanOrEqual(33);
  });
});
