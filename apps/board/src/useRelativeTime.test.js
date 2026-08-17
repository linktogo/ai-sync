import { test, expect } from 'vitest';
import { relativeTime } from './useRelativeTime.js';

const base = Date.parse('2026-06-21T10:00:00.000Z');

test('formats seconds, minutes, hours and days', () => {
  expect(relativeTime('2026-06-21T09:59:50.000Z', base)).toBe('10s ago');
  expect(relativeTime('2026-06-21T09:57:00.000Z', base)).toBe('3 min ago');
  expect(relativeTime('2026-06-21T07:00:00.000Z', base)).toBe('3h ago');
  expect(relativeTime('2026-06-19T10:00:00.000Z', base)).toBe('2d ago');
});

test('returns empty string for a missing timestamp', () => {
  expect(relativeTime(null, base)).toBe('');
});

test('clamps future timestamps to 0 s', () => {
  expect(relativeTime('2026-06-21T10:00:30.000Z', base)).toBe('0s ago');
});
