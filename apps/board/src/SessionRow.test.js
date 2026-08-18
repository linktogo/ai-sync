import { test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SessionRow from './SessionRow.vue';

const now = Date.parse('2026-06-21T10:00:00.000Z');

function session(overrides = {}) {
  return {
    sessionId: 's1',
    status: 'inprogress',
    lastEvent: 'UserPromptSubmit',
    updatedAt: '2026-06-21T09:59:00.000Z',
    title: 'fix login redirect',
    lastPrompt: 'fix login redirect',
    events: [],
    ...overrides,
  };
}

test('renders the title and a relative time', () => {
  const w = mount(SessionRow, { props: { session: session(), now } });
  expect(w.text()).toContain('fix login redirect');
  expect(w.text()).toContain('1 min ago');
});

test('emits "open" with the session id on click', async () => {
  const w = mount(SessionRow, { props: { session: session(), now } });
  await w.get('[data-test=session-row]').trigger('click');
  expect(w.emitted('open')[0]).toEqual(['s1']);
});

test('clips a prompt longer than 140 characters and shows a toggle', () => {
  const long = 'x'.repeat(200);
  const w = mount(SessionRow, { props: { session: session({ lastPrompt: long }), now } });
  expect(w.text()).toContain(`${'x'.repeat(140)}…`);
  expect(w.find('[data-test=toggle-prompt]').exists()).toBe(true);
});

test('does not show a toggle when the prompt is 140 characters or shorter', () => {
  const w = mount(SessionRow, { props: { session: session({ lastPrompt: 'x'.repeat(140) }), now } });
  expect(w.find('[data-test=toggle-prompt]').exists()).toBe(false);
});

test('toggling expands and collapses the full prompt without emitting open', async () => {
  const long = 'y'.repeat(200);
  const w = mount(SessionRow, { props: { session: session({ lastPrompt: long }), now } });
  await w.get('[data-test=toggle-prompt]').trigger('click');
  expect(w.text()).toContain(long);
  expect(w.emitted('open')).toBeUndefined();
  await w.get('[data-test=toggle-prompt]').trigger('click');
  expect(w.text()).not.toContain(long);
});

test('shows a token badge with the formatted total when usage is present', () => {
  const w = mount(SessionRow, {
    props: {
      session: session({ usage: { inputTokens: 100, outputTokens: 200, cacheCreationInputTokens: 300, cacheReadInputTokens: 36000 } }),
      now,
    },
  });
  expect(w.get('[data-test=token-badge]').text()).toContain('36.6K tokens');
});

test('does not show a token badge when usage is absent', () => {
  const w = mount(SessionRow, { props: { session: session(), now } });
  expect(w.find('[data-test=token-badge]').exists()).toBe(false);
});

test('the token badge tooltip breaks down usage by type', () => {
  const w = mount(SessionRow, {
    props: {
      session: session({ usage: { inputTokens: 1, outputTokens: 2, cacheCreationInputTokens: 3, cacheReadInputTokens: 4 } }),
      now,
    },
  });
  expect(w.get('[data-test=token-badge]').attributes('title')).toBe('input 1 · output 2 · cache write 3 · cache read 4');
});

test('dragstart sets the drag payload to the repo name and session id', async () => {
  const w = mount(SessionRow, { props: { session: session(), repoName: 'oc-be', now } });
  const setData = vi.fn();
  await w.get('[data-test=session-row]').trigger('dragstart', { dataTransfer: { setData, effectAllowed: null } });
  expect(setData).toHaveBeenCalledWith('application/json', JSON.stringify({ repo: 'oc-be', sessionId: 's1' }));
});

test('shows a worktree badge with the branch when the session runs in a worktree', () => {
  const w = mount(SessionRow, { props: { session: session({ worktree: 'feat/login' }), now } });
  const badge = w.get('[data-test=worktree-badge]');
  expect(badge.text()).toContain('feat/login');
  expect(badge.attributes('title')).toBe('Isolated in git worktree · branch feat/login');
});

test('does not show a worktree badge when the session has no worktree', () => {
  const w = mount(SessionRow, { props: { session: session(), now } });
  expect(w.find('[data-test=worktree-badge]').exists()).toBe(false);
});
