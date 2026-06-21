import { test, expect, vi } from 'vitest';
import { nextTick } from 'vue';
import { useBoard } from './useBoard.js';

test('useBoard fetches immediately and exposes repos', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ json: async () => ({ version: 1, repos: { a: { status: 'todo' } } }) });
  const { repos, stop } = useBoard({ intervalMs: 1000, fetchImpl });
  await nextTick();
  await Promise.resolve();
  expect(fetchImpl).toHaveBeenCalledWith('/api/board');
  expect(repos.value).toEqual({ a: { status: 'todo' } });
  stop();
});

test('useBoard polls on the interval', async () => {
  vi.useFakeTimers();
  const fetchImpl = vi.fn().mockResolvedValue({ json: async () => ({ version: 1, repos: {} }) });
  const { stop } = useBoard({ intervalMs: 500, fetchImpl });
  await vi.advanceTimersByTimeAsync(1100);
  expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(3); // immediate + 2 ticks
  stop();
  vi.useRealTimers();
});
