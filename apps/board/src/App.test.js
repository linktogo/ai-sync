import { test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from './App.vue';

test('App groups repos into the four columns', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    json: async () => ({
      version: 1,
      repos: {
        a: { status: 'todo', lastEvent: 'init', updatedAt: 'T' },
        b: { status: 'question', lastEvent: 'Stop', updatedAt: 'T' },
        c: { status: 'question', lastEvent: 'Notification', updatedAt: 'T' },
      },
    }),
  });
  const wrapper = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await nextTick();
  await Promise.resolve();
  await nextTick();
  const columns = wrapper.findAll('section');
  expect(columns).toHaveLength(4);
  // question column (index 2) shows 2 cards
  expect(columns[2].text()).toContain('(2)');
  expect(wrapper.text()).toContain('a');
  expect(wrapper.text()).toContain('b');
});
