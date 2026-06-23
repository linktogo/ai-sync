import { test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from './App.vue';

function routedFetch() {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/config') {
      return Promise.resolve({ json: async () => ({ repos: { a: { url: 'u', technologies: ['nestjs'], targets: [] } } }) });
    }
    return Promise.resolve({ json: async () => ({
      version: 1,
      repos: {
        a: { status: 'todo', lastEvent: 'init', updatedAt: 'T', events: [] },
        b: { status: 'question', lastEvent: 'Stop', updatedAt: 'T', events: [] },
        c: { status: 'question', lastEvent: 'Notification', updatedAt: 'T', events: [] },
      },
    }) });
  });
}

async function settle() { await nextTick(); await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

test('App groups repos into the four columns', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  const columns = wrapper.findAll('section');
  expect(columns).toHaveLength(4);
  expect(columns[2].text()).toContain('(2)');
  expect(wrapper.text()).toContain('a');
  expect(wrapper.text()).toContain('b');
});

test('App renders the summary header and filter bar', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  expect(wrapper.text()).toContain('repos');
  expect(wrapper.find('[data-test=search]').exists()).toBe(true);
});

test('clicking a card opens the detail panel', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  await wrapper.get('section button').trigger('click'); // first card (cards are buttons inside a column section)
  expect(wrapper.find('aside').exists()).toBe(true);
});

test('typing in the search filters the cards', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  await wrapper.get('[data-test=search]').setValue('b');
  await nextTick();
  expect(wrapper.text()).toContain('b');
  expect(wrapper.text()).not.toContain('Notification'); // card 'c' filtered out
});
