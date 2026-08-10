import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Card from './Card.vue';
import SessionRow from './SessionRow.vue';

const now = Date.parse('2026-06-21T10:00:00.000Z');

function session(overrides = {}) {
  return {
    sessionId: 's1', status: 'todo', lastEvent: 'init',
    updatedAt: '2026-06-21T09:59:00.000Z', title: 'fix login', lastPrompt: 'fix login', events: [],
    ...overrides,
  };
}

test('renders the repo name and one row per session', () => {
  const w = mount(Card, { props: { name: 'oc-be', sessions: [session(), session({ sessionId: 's2', title: 'add tests' })], status: 'inprogress', now } });
  expect(w.text()).toContain('oc-be');
  expect(w.text()).toContain('fix login');
  expect(w.text()).toContain('add tests');
  expect(w.findAll('[data-test=session-row]')).toHaveLength(2);
});

test('shows a placeholder when the repo has no active sessions', () => {
  const w = mount(Card, { props: { name: 'oc-be', sessions: [], status: 'todo', now } });
  expect(w.text()).toContain('Aucune session active');
});

test('highlights a question card', () => {
  const w = mount(Card, { props: { name: 'oc-auth', sessions: [session()], status: 'question', now } });
  expect(w.classes().join(' ')).toContain('ring-amber-300');
});

test('emits "open" with the repo name and session id when a row is clicked', async () => {
  const w = mount(Card, { props: { name: 'oc-be', sessions: [session()], status: 'todo', now } });
  await w.get('[data-test=session-row]').trigger('click');
  expect(w.emitted('open')[0]).toEqual([{ name: 'oc-be', sessionId: 's1' }]);
});

test('passes its repo name down to each session row', () => {
  const w = mount(Card, { props: { name: 'oc-be', sessions: [session()], status: 'todo', now } });
  expect(w.findComponent(SessionRow).props('repoName')).toBe('oc-be');
});
