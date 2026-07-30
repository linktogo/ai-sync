import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, rankState, parseUpdate, buildUpdate } from '../src/ci-status.js';

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

const NOW = '2026-07-29T18:41:12.000Z';

test('buildUpdate reads the workflow_run payload when triggered by workflow_run', () => {
  const env = { GITHUB_EVENT_NAME: 'workflow_run', GITHUB_REPOSITORY: 'linktogo/lk-myasso' };
  const event = {
    workflow_run: {
      id: 42, name: 'CI', status: 'completed', conclusion: 'failure',
      head_branch: 'feat/x', event: 'push', actor: { login: 'fabien' },
      html_url: 'https://github.com/linktogo/lk-myasso/actions/runs/42',
      run_started_at: '2026-07-29T18:40:00.000Z',
    },
  };
  assert.deepEqual(buildUpdate(env, event, NOW), {
    repo: 'lk-myasso', actor: 'fabien', runId: 42, status: 'completed',
    conclusion: 'failure', workflow: 'CI', branch: 'feat/x', event: 'push',
    url: 'https://github.com/linktogo/lk-myasso/actions/runs/42',
    startedAt: '2026-07-29T18:40:00.000Z', sentAt: NOW,
  });
});

test('buildUpdate reads the job context when used as an in-job step', () => {
  const env = {
    GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'linktogo/lk-mind',
    GITHUB_ACTOR: 'alice', GITHUB_RUN_ID: '77', GITHUB_WORKFLOW: 'Build',
    GITHUB_REF_NAME: 'main', GITHUB_SERVER_URL: 'https://github.com',
    JOB_STATUS: 'success',
  };
  assert.deepEqual(buildUpdate(env, {}, NOW), {
    repo: 'lk-mind', actor: 'alice', runId: 77, status: 'completed',
    conclusion: 'success', workflow: 'Build', branch: 'main', event: 'push',
    url: 'https://github.com/linktogo/lk-mind/actions/runs/77',
    startedAt: NOW, sentAt: NOW,
  });
});
