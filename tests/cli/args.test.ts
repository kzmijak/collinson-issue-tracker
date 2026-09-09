import { describe, expect, it } from 'vitest';
import { numberFlag, positional } from '../../src/cli/args.js';

describe('positional', () => {
  it('finds the spec among flags', () => {
    expect(positional(['--force', '001', '--rounds', '2'], ['--rounds'])).toBe('001');
  });

  it("never mistakes a flag's own value for the spec", () => {
    expect(positional(['--rounds', '3'], ['--rounds'])).toBeUndefined();
  });

  it('returns nothing when only flags were given', () => {
    expect(positional(['--force'])).toBeUndefined();
  });
});

describe('numberFlag', () => {
  it('reads the value after the flag', () => {
    expect(numberFlag(['--rounds', '5'], '--rounds')).toBe(5);
  });

  it('refuses a value that is not a positive number, so the default stands', () => {
    expect(numberFlag(['--rounds', 'lots'], '--rounds')).toBeNull();
    expect(numberFlag(['--rounds', '0'], '--rounds')).toBeNull();
    expect(numberFlag(['--rounds'], '--rounds')).toBeNull();
  });

  it('returns null when the flag is absent', () => {
    expect(numberFlag(['001'], '--rounds')).toBeNull();
  });
});
