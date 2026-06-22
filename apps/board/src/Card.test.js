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
