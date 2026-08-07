import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryHeader from './SummaryHeader.vue';

const repos = {
  a: { sessions: {} }, // idle repo -> counts as one "todo" card
  b: { sessions: { s1: { status: 'inprogress' } } },
  c: { sessions: { s2: { status: 'question' } } },
  d: { sessions: { s3: { status: 'done' }, s4: { status: 'done' } } }, // two sessions on one repo
};

test('shows total and per-status counts', () => {
  const w = mount(SummaryHeader, { props: { repos } });
  expect(w.text()).toContain('5');         // total: a(1) + b(1) + c(1) + d(2)
  expect(w.text()).toContain('1 Question');
  expect(w.text()).toContain('2 Done');
});

test('computes the done percentage', () => {
  const w = mount(SummaryHeader, { props: { repos } });
  expect(w.text()).toContain('40 %');       // 2 of 5
  expect(w.get('[data-test=progress]').attributes('style')).toContain('40%');
});

test('handles an empty board without dividing by zero', () => {
  const w = mount(SummaryHeader, { props: { repos: {} } });
  expect(w.text()).toContain('0 %');
});
