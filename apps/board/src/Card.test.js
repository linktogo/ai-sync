import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Card from './Card.vue';

const now = Date.parse('2026-06-21T10:00:00.000Z');

test('renders the repo name and a relative time', () => {
  const repo = { status: 'todo', lastEvent: 'init', updatedAt: '2026-06-21T09:59:00.000Z' };
  const w = mount(Card, { props: { name: 'oc-be', repo, now } });
  expect(w.text()).toContain('oc-be');
  expect(w.text()).toContain('il y a 1 min');
});

test('highlights a question card', () => {
  const repo = { status: 'question', lastEvent: 'Stop', updatedAt: '2026-06-21T10:00:00.000Z' };
  const w = mount(Card, { props: { name: 'oc-auth', repo, now } });
  expect(w.classes().join(' ')).toContain('ring-amber-200');
});

test('emits "open" with the repo name on click', async () => {
  const repo = { status: 'todo', lastEvent: 'init', updatedAt: '2026-06-21T10:00:00.000Z' };
  const w = mount(Card, { props: { name: 'oc-be', repo, now } });
  await w.trigger('click');
  expect(w.emitted('open')[0]).toEqual(['oc-be']);
});

const repoTodo = { status: 'todo', lastEvent: 'init', updatedAt: '2026-06-21T09:59:00.000Z' };

test('renders one badge per contributor, worst first', () => {
  const ci = { users: { zoe: { state: 'success' }, alice: { state: 'failure' } } };
  const w = mount(Card, { props: { name: 'oc-be', repo: repoTodo, now, ci } });
  const badges = w.findAll('[data-test=ci-badge]');
  expect(badges.map((b) => b.text())).toEqual(['AL', 'ZO']);
  expect(badges[0].classes().join(' ')).toContain('red');
});

test('collapses beyond four contributors into a +N badge', () => {
  const users = {};
  for (const login of ['a1', 'b2', 'c3', 'd4', 'e5']) users[login] = { state: 'success' };
  const w = mount(Card, { props: { name: 'oc-be', repo: repoTodo, now, ci: { users } } });
  expect(w.findAll('[data-test=ci-badge]')).toHaveLength(4);
  expect(w.get('[data-test=ci-overflow]').text()).toBe('+1');
});

test('renders no badges when the repo has no CI status', () => {
  const w = mount(Card, { props: { name: 'oc-be', repo: repoTodo, now } });
  expect(w.findAll('[data-test=ci-badge]')).toHaveLength(0);
  expect(w.find('[data-test=ci-overflow]').exists()).toBe(false);
});

test('badges expose state through aria-label, not colour alone', () => {
  const users = {};
  for (const login of ['a1', 'b2', 'c3', 'd4', 'e5']) users[login] = { state: 'success' };
  users.alice = { state: 'failure' };
  const w = mount(Card, { props: { name: 'oc-be', repo: repoTodo, now, ci: { users } } });
  const badge = w.get('[data-test=ci-badge]');
  expect(badge.attributes('aria-label')).toContain('alice');
  expect(badge.attributes('aria-label')).toContain('failure');
  const overflow = w.get('[data-test=ci-overflow]');
  expect(overflow.attributes('aria-label')).toBeTruthy();
});
