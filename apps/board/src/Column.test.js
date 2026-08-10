import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Column from './Column.vue';

function mountColumn(status) {
  return mount(Column, { props: { title: 'Done', status, entries: [], now: 0 } });
}

test('drop on the done column emits close-session with the dropped payload', async () => {
  const w = mountColumn('done');
  const dataTransfer = { getData: () => JSON.stringify({ repo: 'oc-be', sessionId: 's1' }) };
  await w.get('[data-test=column-body]').trigger('drop', { dataTransfer });
  expect(w.emitted('close-session')[0]).toEqual([{ repo: 'oc-be', sessionId: 's1' }]);
});

test('dragover on the done column highlights the drop zone, dragleave clears it', async () => {
  const w = mountColumn('done');
  const body = w.get('[data-test=column-body]');
  await body.trigger('dragover');
  expect(body.classes()).toContain('ring-2');
  await body.trigger('dragleave');
  expect(body.classes()).not.toContain('ring-2');
});

test('dropping clears the drop-zone highlight', async () => {
  const w = mountColumn('done');
  const body = w.get('[data-test=column-body]');
  await body.trigger('dragover');
  expect(body.classes()).toContain('ring-2');
  const dataTransfer = { getData: () => JSON.stringify({ repo: 'a', sessionId: 's1' }) };
  await body.trigger('drop', { dataTransfer });
  expect(body.classes()).not.toContain('ring-2');
});

test('a non-done column has no drag listeners: dragover does not highlight, drop emits nothing', async () => {
  const w = mountColumn('todo');
  const body = w.get('[data-test=column-body]');
  await body.trigger('dragover');
  expect(body.classes()).not.toContain('ring-2');
  const dataTransfer = { getData: () => JSON.stringify({ repo: 'a', sessionId: 's1' }) };
  await body.trigger('drop', { dataTransfer });
  expect(w.emitted('close-session')).toBeUndefined();
});
