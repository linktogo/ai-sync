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

function ciRoutedFetch({ board = { version: 1, repos: {} }, ci = { repos: {}, lastSyncError: null } }) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/config') return Promise.resolve({ json: async () => ({ repos: {} }) });
    if (url === '/api/ci') return Promise.resolve({ json: async () => ci });
    return Promise.resolve({ json: async () => board });
  });
}

const CARD = { status: 'todo', lastEvent: 'init', updatedAt: '2026-06-21T09:59:00.000Z', events: [] };

test('renders CI badges coming from /api/ci', async () => {
  const fetchImpl = ciRoutedFetch({
    board: { version: 1, repos: { 'oc-be': CARD } },
    ci: { repos: { 'oc-be': { users: { alice: { state: 'failure' } } } }, lastSyncError: null },
  });
  const w = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  expect(w.get('[data-test=ci-badge]').text()).toBe('AL');
});

test('the CI filter hides repos that do not match', async () => {
  const fetchImpl = ciRoutedFetch({
    board: { version: 1, repos: { 'repo-green': CARD, 'repo-red': CARD } },
    ci: { repos: {
      'repo-green': { users: { alice: { state: 'success' } } },
      'repo-red': { users: { alice: { state: 'failure' } } },
    }, lastSyncError: null },
  });
  const w = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  await w.get('[data-test=ci]').setValue('failure');
  await nextTick();
  expect(w.text()).toContain('repo-red');
  expect(w.text()).not.toContain('repo-green');
});

test('shows a desync banner when the server reports a sync error', async () => {
  const fetchImpl = ciRoutedFetch({ ci: { repos: {}, lastSyncError: 'could not read from remote' } });
  const w = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  expect(w.get('[data-test=ci-desync]').text()).toContain('désynchronisé');
});
