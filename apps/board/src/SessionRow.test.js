import { test, expect } from 'vitest';
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
  expect(w.text()).toContain('il y a 1 min');
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
