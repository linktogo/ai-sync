import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RepoDetail from './RepoDetail.vue';

const now = Date.parse('2026-06-21T10:00:00.000Z');
const repo = {
  status: 'question', lastEvent: 'waiting', updatedAt: '2026-06-21T10:00:00.000Z',
  events: [
    { event: 'waiting input', at: '2026-06-21T09:59:48.000Z' },
    { event: 'edit src/', at: '2026-06-21T09:57:00.000Z' },
  ],
};
const meta = { url: 'https://h/oc-auth.git', technologies: ['nestjs'], targets: ['claude'] };

test('renders url, technologies and the event timeline', () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', repo, meta, now } });
  expect(w.get('a').attributes('href')).toBe('https://h/oc-auth.git');
  expect(w.text()).toContain('nestjs');
  expect(w.text()).toContain('waiting input');
  expect(w.text()).toContain('il y a 12 s');
});

test('renders nothing when name is null', () => {
  const w = mount(RepoDetail, { props: { name: null, repo: null, meta: null, now } });
  expect(w.find('aside').exists()).toBe(false);
});

test('emits close on overlay click and on Escape', async () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', repo, meta, now }, attachTo: document.body });
  await w.get('[data-test=overlay]').trigger('click');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(w.emitted('close').length).toBeGreaterThanOrEqual(2);
  w.unmount();
});
