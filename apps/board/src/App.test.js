import { test, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from './App.vue';
import Column from './Column.vue';

afterEach(() => { vi.restoreAllMocks(); });

function routedFetch() {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/config') {
      return Promise.resolve({ json: async () => ({ repos: { a: { url: 'u', technologies: ['nestjs'], targets: [] } } }) });
    }
    return Promise.resolve({ json: async () => ({
      version: 2,
      repos: {
        a: { sessions: {} }, // idle repo -> todo placeholder card
        b: { sessions: { s1: { status: 'question', lastEvent: 'Stop', updatedAt: 'T', title: 'fix login', lastPrompt: 'fix login', events: [] } } },
        c: { sessions: { s2: { status: 'question', lastEvent: 'Notification', updatedAt: 'T', title: 'review PR', lastPrompt: 'review PR', events: [] } } },
        d: { sessions: { // one repo, two sessions in two different statuses -> two separate cards
          s3: { status: 'todo', lastEvent: 'init', updatedAt: 'T', title: 'd todo item', lastPrompt: 'd todo item', events: [] },
          s4: { status: 'question', lastEvent: 'Stop', updatedAt: 'T', title: 'd question item', lastPrompt: 'd question item', events: [] },
        } },
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
  expect(columns[2].text()).toContain('(3)'); // repos b, c and d each have a session in "question"
  expect(wrapper.text()).toContain('a');
  expect(wrapper.text()).toContain('b');
});

test('a repo with sessions in two different statuses gets a separate card per matching column', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  const columns = wrapper.findAll('section');
  const todoColumn = columns[0];
  const questionColumn = columns[2];

  // repo "d" shows up in both the "todo" and "question" columns...
  expect(todoColumn.text()).toContain('d');
  expect(questionColumn.text()).toContain('d');

  // ...but each column's card for "d" lists only that column's matching session.
  expect(todoColumn.text()).toContain('d todo item');
  expect(todoColumn.text()).not.toContain('d question item');
  expect(questionColumn.text()).toContain('d question item');
  expect(questionColumn.text()).not.toContain('d todo item');
});

test('App renders the summary header and filter bar', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  expect(wrapper.text()).toContain('repos');
  expect(wrapper.find('[data-test=search]').exists()).toBe(true);
});

test('clicking a session row opens the detail panel', async () => {
  const wrapper = mount(App, { props: { fetchImpl: routedFetch(), intervalMs: 100000 } });
  await settle();
  await wrapper.get('[data-test=session-row]').trigger('click');
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

test('toggling to the Historique tab shows history entries instead of the board', async () => {
  const fetchImpl = vi.fn().mockImplementation((url) => {
    if (url === '/api/config') return Promise.resolve({ json: async () => ({ repos: {} }) });
    if (url === '/api/history') {
      return Promise.resolve({
        json: async () => ([{
          repo: 'oc-be', sessionId: 's1', title: 'fix login',
          startedAt: 'T0', endedAt: 'T1',
          usage: { inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 1, cacheReadInputTokens: 1 },
        }]),
      });
    }
    return Promise.resolve({ json: async () => ({ version: 2, repos: {} }) });
  });
  const wrapper = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  await wrapper.get('[data-test=view-history]').trigger('click');
  await settle();
  expect(wrapper.find('section').exists()).toBe(false);
  expect(wrapper.text()).toContain('fix login');
});

test('dropping a session on Done confirms, closes it via the API, and refreshes the board', async () => {
  const calls = [];
  const fetchImpl = vi.fn().mockImplementation((url) => {
    calls.push(url);
    if (url === '/api/config') return Promise.resolve({ json: async () => ({ repos: {} }) });
    if (url === '/api/sessions/close') return Promise.resolve({ json: async () => ({ closed: true }) });
    return Promise.resolve({ json: async () => ({
      version: 2,
      repos: { b: { sessions: { s1: { status: 'question', lastEvent: 'Stop', updatedAt: 'T', title: 'fix login', lastPrompt: 'fix login', events: [] } } } },
    }) });
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const wrapper = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  const boardCallsBefore = calls.filter((u) => u === '/api/board').length;

  const doneColumn = wrapper.findAllComponents(Column)[3];
  await doneColumn.vm.$emit('close-session', { repo: 'b', sessionId: 's1' });
  await settle();

  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('fix login'));
  const closeCall = fetchImpl.mock.calls.find(([u]) => u === '/api/sessions/close');
  expect(closeCall[1]).toMatchObject({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo: 'b', sessionId: 's1' }),
  });
  const boardCallsAfter = calls.filter((u) => u === '/api/board').length;
  expect(boardCallsAfter).toBeGreaterThan(boardCallsBefore);
});

test('declining the confirm on drop does not call the close API', async () => {
  const fetchImpl = routedFetch();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const wrapper = mount(App, { props: { fetchImpl, intervalMs: 100000 } });
  await settle();
  const doneColumn = wrapper.findAllComponents(Column)[3];
  await doneColumn.vm.$emit('close-session', { repo: 'b', sessionId: 's1' });
  await settle();
  expect(fetchImpl.mock.calls.some(([u]) => u === '/api/sessions/close')).toBe(false);
});
