import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, rankState, parseUpdate } from '../src/ci-status.js';

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

const VALID = {
  repo: 'lk-myasso', actor: 'fabien', runId: 42, status: 'completed',
  conclusion: 'failure', workflow: 'CI', branch: 'feat/x', event: 'push',
  url: 'https://github.com/linktogo/lk-myasso/actions/runs/42',
  startedAt: '2026-07-29T18:40:00.000Z', sentAt: '2026-07-29T18:41:12.000Z',
};
const AT = { login: 'fabien', repo: 'lk-myasso' };

test('parseUpdate accepts a well-formed payload', () => {
  const result = parseUpdate(JSON.stringify(VALID), AT);
  assert.equal(result.ok, true);
  assert.deepEqual(result.update, VALID);
});

test('parseUpdate accepts a null conclusion for a run still going', () => {
  const raw = JSON.stringify({ ...VALID, status: 'in_progress', conclusion: null });
  assert.equal(parseUpdate(raw, AT).ok, true);
});

test('parseUpdate rejects malformed input without throwing', () => {
  const cases = [
    ['not json at all', /invalid JSON/],
    ['[]', /not an object/],
    ['null', /not an object/],
    [JSON.stringify({ ...VALID, repo: undefined }), /"repo"/],
    [JSON.stringify({ ...VALID, actor: '' }), /"actor"/],
    [JSON.stringify({ ...VALID, status: 7 }), /"status"/],
    [JSON.stringify({ ...VALID, runId: 'forty-two' }), /"runId"/],
  ];
  for (const [raw, pattern] of cases) {
    const result = parseUpdate(raw, AT);
    assert.equal(result.ok, false, raw);
    assert.match(result.reason, pattern);
  }
});

test('parseUpdate rejects a file sitting in the wrong folder or under the wrong name', () => {
  const wrongUser = parseUpdate(JSON.stringify(VALID), { login: 'alice', repo: 'lk-myasso' });
  assert.equal(wrongUser.ok, false);
  assert.match(wrongUser.reason, /actor "fabien" does not match folder "alice"/);

  const wrongRepo = parseUpdate(JSON.stringify(VALID), { login: 'fabien', repo: 'lk-mind' });
  assert.equal(wrongRepo.ok, false);
  assert.match(wrongRepo.reason, /repo "lk-myasso" does not match file "lk-mind"/);
});
