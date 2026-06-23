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

test('useBoard reports no transitions on the first fetch (baseline)', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ json: async () => ({ repos: { a: { status: 'question' } } }) });
  const { transitions, stop } = useBoard({ intervalMs: 100000, fetchImpl });
  await nextTick(); await Promise.resolve(); await nextTick();
  expect(transitions.value).toEqual([]);
  stop();
});

test('useBoard detects transitions into question/done on later fetches', async () => {
  const responses = [
    { repos: { a: { status: 'inprogress' }, b: { status: 'todo' } } },
    { repos: { a: { status: 'question' }, b: { status: 'done' } } },
  ];
  const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve({ json: async () => responses.shift() }));
  const { transitions, refresh, stop } = useBoard({ intervalMs: 100000, fetchImpl });
  await nextTick(); await Promise.resolve(); await nextTick();
  await refresh();
  expect(transitions.value).toEqual([{ name: 'a', status: 'question' }, { name: 'b', status: 'done' }]);
  stop();
});

test('useBoard sets connected=false on a fetch error', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));
  const { connected, stop } = useBoard({ intervalMs: 100000, fetchImpl });
  await nextTick(); await Promise.resolve(); await nextTick();
  expect(connected.value).toBe(false);
  stop();
});
