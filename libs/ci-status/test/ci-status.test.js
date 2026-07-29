import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, rankState } from '../src/ci-status.js';

test('normalizeState maps every GitHub status/conclusion pair', () => {
  const cases = [
    [['queued', null], 'running'],
    [['in_progress', null], 'running'],
    [['waiting', null], 'running'],
    [['completed', 'success'], 'success'],
    [['completed', 'failure'], 'failure'],
    [['completed', 'timed_out'], 'failure'],
    [['completed', 'startup_failure'], 'failure'],
    [['completed', 'action_required'], 'failure'],
    [['completed', 'cancelled'], 'neutral'],
    [['completed', 'skipped'], 'neutral'],
    [['completed', 'neutral'], 'neutral'],
    [['completed', 'stale'], 'neutral'],
    [['completed', 'something_new'], 'neutral'],
    [['completed', null], 'neutral'],
  ];
  for (const [[status, conclusion], expected] of cases) {
    assert.equal(normalizeState(status, conclusion), expected, `${status}/${conclusion}`);
  }
});

test('rankState orders worst first and treats unknown states as none', () => {
  assert.ok(rankState('failure') < rankState('running'));
  assert.ok(rankState('running') < rankState('neutral'));
  assert.ok(rankState('neutral') < rankState('success'));
  assert.ok(rankState('success') < rankState('none'));
  assert.equal(rankState('bogus'), rankState('none'));
});
