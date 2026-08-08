import { test, expect } from 'vitest';
import { formatTokens } from './formatTokens.js';

test('formats sub-1000 values as-is', () => {
  expect(formatTokens(0)).toBe('0');
  expect(formatTokens(999)).toBe('999');
});

test('formats thousands with one decimal and a K suffix', () => {
  expect(formatTokens(1000)).toBe('1.0K');
  expect(formatTokens(36420)).toBe('36.4K');
});

test('formats millions with one decimal and an M suffix', () => {
  expect(formatTokens(1_200_000)).toBe('1.2M');
});
