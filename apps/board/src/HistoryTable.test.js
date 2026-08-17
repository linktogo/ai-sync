import { test, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HistoryTable from './HistoryTable.vue';
import { DEFAULT_LOCALE, locale, setLocale } from './i18n.js';

afterEach(() => { locale.value = DEFAULT_LOCALE; });

function entry(overrides = {}) {
  return {
    repo: 'oc-be',
    sessionId: 's1',
    title: 'fix login',
    startedAt: '2026-06-21T09:00:00.000Z',
    endedAt: '2026-06-21T09:10:00.000Z',
    usage: { inputTokens: 100, outputTokens: 200, cacheCreationInputTokens: 300, cacheReadInputTokens: 400 },
    ...overrides,
  };
}

test('renders one row per entry', () => {
  const w = mount(HistoryTable, { props: { entries: [entry(), entry({ sessionId: 's2', repo: 'other' })] } });
  expect(w.findAll('[data-test=history-row]')).toHaveLength(2);
});

test('shows a placeholder message when there are no entries', () => {
  const w = mount(HistoryTable, { props: { entries: [] } });
  expect(w.text()).toContain('No completed session yet');
});

test('filtering by repo name hides non-matching rows', async () => {
  const w = mount(HistoryTable, { props: { entries: [entry(), entry({ sessionId: 's2', repo: 'other' })] } });
  await w.get('[data-test=history-repo-filter]').setValue('oc-be');
  const rows = w.findAll('[data-test=history-row]');
  expect(rows).toHaveLength(1);
  expect(rows[0].text()).toContain('oc-be');
});

test('clicking a column header sorts rows, and clicking again reverses the order', async () => {
  const w = mount(HistoryTable, {
    props: { entries: [entry({ repo: 'b', sessionId: 's1' }), entry({ repo: 'a', sessionId: 's2' })] },
  });
  await w.get('[data-test=sort-repo]').trigger('click');
  let rows = w.findAll('[data-test=history-row]');
  expect(rows[0].text()).toContain('a');
  await w.get('[data-test=sort-repo]').trigger('click');
  rows = w.findAll('[data-test=history-row]');
  expect(rows[0].text()).toContain('b');
});

test('headers and the duration unit follow the selected language', async () => {
  const w = mount(HistoryTable, { props: { entries: [entry()] } });
  expect(w.text()).toContain('Started');
  expect(w.text()).toContain('10 min');

  setLocale('de', { storage: null, doc: null });
  await w.vm.$nextTick();
  expect(w.text()).toContain('Gestartet');
  expect(w.text()).toContain('10 Min.');
});
