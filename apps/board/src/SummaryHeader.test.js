import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryHeader from './SummaryHeader.vue';

const repos = {
  a: { status: 'todo' }, b: { status: 'inprogress' },
  c: { status: 'question' }, d: { status: 'done' }, e: { status: 'done' },
};

test('shows total and per-status counts', () => {
  const w = mount(SummaryHeader, { props: { repos } });
  expect(w.text()).toContain('5');         // total
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
