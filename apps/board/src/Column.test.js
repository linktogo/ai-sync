import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Column from './Column.vue';

const repo = { status: 'todo', lastEvent: 'init', updatedAt: '2026-06-21T09:59:00.000Z' };
const now = Date.parse('2026-06-21T10:00:00.000Z');

test('passes each entry its own CI status', () => {
  const w = mount(Column, {
    props: {
      title: 'To do', entries: [{ name: 'oc-be', repo }], now,
      ci: { 'oc-be': { users: { alice: { state: 'failure' } } } },
    },
  });
  expect(w.get('[data-test=ci-badge]').text()).toBe('AL');
});

test('renders cards unharmed when no CI map is given', () => {
  const w = mount(Column, { props: { title: 'To do', entries: [{ name: 'oc-be', repo }], now } });
  expect(w.text()).toContain('oc-be');
  expect(w.findAll('[data-test=ci-badge]')).toHaveLength(0);
});
