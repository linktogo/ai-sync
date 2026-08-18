import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RepoDetail from './RepoDetail.vue';

const now = Date.parse('2026-06-21T10:00:00.000Z');
const session = {
  status: 'question', lastEvent: 'waiting', updatedAt: '2026-06-21T10:00:00.000Z',
  title: 'fix auth redirect', lastPrompt: 'fix the auth redirect loop on logout',
  events: [
    { event: 'waiting input', at: '2026-06-21T09:59:48.000Z' },
    { event: 'edit src/', at: '2026-06-21T09:57:00.000Z' },
  ],
};
const meta = { url: 'https://h/oc-auth.git', technologies: ['nestjs'], targets: ['claude'] };

test('renders url, technologies, the session title/prompt, and the event timeline', () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', session, meta, now } });
  expect(w.get('a').attributes('href')).toBe('https://h/oc-auth.git');
  expect(w.text()).toContain('nestjs');
  expect(w.text()).toContain('fix auth redirect');
  expect(w.text()).toContain('fix the auth redirect loop on logout');
  expect(w.text()).toContain('waiting input');
  expect(w.text()).toContain('12s ago');
});

test('renders nothing when name is null', () => {
  const w = mount(RepoDetail, { props: { name: null, session: null, meta: null, now } });
  expect(w.find('aside').exists()).toBe(false);
});

test('emits close on overlay click and on Escape', async () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', session, meta, now }, attachTo: document.body });
  await w.get('[data-test=overlay]').trigger('click');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(w.emitted('close').length).toBeGreaterThanOrEqual(2);
  w.unmount();
});

const nowTs = Date.parse('2026-07-29T10:00:00.000Z');

test('lists each contributor CI run with a link to it', () => {
  const ci = { users: { fabien: { state: 'failure', run: {
    workflow: 'CI', branch: 'feat/x', conclusion: 'failure',
    url: 'https://github.com/linktogo/lk-myasso/actions/runs/42',
    startedAt: '2026-07-29T09:59:00.000Z',
  } } } };
  const w = mount(RepoDetail, { props: { name: 'lk-myasso', session: null, meta: null, now: nowTs, ci } });
  const line = w.get('[data-test=ci-user]');
  expect(line.text()).toContain('fabien');
  expect(line.text()).toContain('CI');
  expect(line.text()).toContain('feat/x');
  // The relative time is the guard against a stale green reading as current.
  expect(line.text()).toContain('1 min ago');
  expect(w.get('[data-test=ci-link]').attributes('href')).toBe('https://github.com/linktogo/lk-myasso/actions/runs/42');
});

test('shows the reason instead of the list when CI is unavailable', () => {
  const ci = { users: {}, unavailable: 'status repo not configured' };
  const w = mount(RepoDetail, { props: { name: 'lk-myasso', session: null, meta: null, now: nowTs, ci } });
  expect(w.get('[data-test=ci-unavailable]').text()).toContain('status repo not configured');
  expect(w.findAll('[data-test=ci-user]')).toHaveLength(0);
});

test('says nothing has been reported when no contributor has run CI', () => {
  const w = mount(RepoDetail, { props: { name: 'lk-myasso', session: null, meta: null, now: nowTs, ci: { users: {} } } });
  expect(w.get('[data-test=ci-empty]').text()).toContain('No status reported');
});

test('shows the message form only when a sessionId is provided', () => {
  const without = mount(RepoDetail, { props: { name: 'oc-auth', session, meta, now } });
  expect(without.find('[data-test=detail-message-form]').exists()).toBe(false);
  const withId = mount(RepoDetail, { props: { name: 'oc-auth', sessionId: 's1', session, meta, now } });
  expect(withId.find('[data-test=detail-message-form]').exists()).toBe(true);
});

test('submitting the detail message form emits send-message with repo, session id and text, then clears it', async () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', sessionId: 's1', session, meta, now } });
  const input = w.get('[data-test=detail-message-input]');
  await input.setValue('  add a test  ');
  await w.get('[data-test=detail-message-form]').trigger('submit');
  expect(w.emitted('send-message')[0]).toEqual([{ repo: 'oc-auth', sessionId: 's1', text: 'add a test' }]);
  expect(input.element.value).toBe('');
});

test('a whitespace-only detail message emits nothing and keeps the send button disabled', async () => {
  const w = mount(RepoDetail, { props: { name: 'oc-auth', sessionId: 's1', session, meta, now } });
  expect(w.get('[data-test=detail-message-send]').attributes('disabled')).toBeDefined();
  await w.get('[data-test=detail-message-input]').setValue('   ');
  await w.get('[data-test=detail-message-form]').trigger('submit');
  expect(w.emitted('send-message')).toBeUndefined();
});

test('lists queued pending messages, and shows an empty hint when there are none', () => {
  const queued = mount(RepoDetail, {
    props: { name: 'oc-auth', sessionId: 's1', session: { ...session, pendingMessages: [{ text: 'queued one', at: 'T0' }] }, meta, now },
  });
  expect(queued.get('[data-test=pending-messages]').text()).toContain('queued one');
  expect(queued.find('[data-test=pending-empty]').exists()).toBe(false);
  const empty = mount(RepoDetail, { props: { name: 'oc-auth', sessionId: 's1', session, meta, now } });
  expect(empty.find('[data-test=pending-messages]').exists()).toBe(false);
  expect(empty.find('[data-test=pending-empty]').exists()).toBe(true);
});
