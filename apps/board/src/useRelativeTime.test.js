import { test, expect } from 'vitest';
import { relativeTime } from './useRelativeTime.js';

const base = Date.parse('2026-06-21T10:00:00.000Z');

test('formats seconds, minutes, hours and days', () => {
  expect(relativeTime('2026-06-21T09:59:50.000Z', base)).toBe('il y a 10 s');
  expect(relativeTime('2026-06-21T09:57:00.000Z', base)).toBe('il y a 3 min');
  expect(relativeTime('2026-06-21T07:00:00.000Z', base)).toBe('il y a 3 h');
  expect(relativeTime('2026-06-19T10:00:00.000Z', base)).toBe('il y a 2 j');
});

test('returns empty string for a missing timestamp', () => {
  expect(relativeTime(null, base)).toBe('');
});

test('clamps future timestamps to 0 s', () => {
  expect(relativeTime('2026-06-21T10:00:30.000Z', base)).toBe('il y a 0 s');
});
