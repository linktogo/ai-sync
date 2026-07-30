// Conclusions that mean "someone has to look at this". Everything else that is
// completed and not a success is informational (cancelled, skipped, stale…).
const FAILURE_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);

// One total order, used both to sort badges worst-first and to aggregate a
// repo's contributors into a single verdict for the filter. Keeping a single
// definition is what stops the card ordering and the filter from disagreeing.
const RANK = { failure: 0, running: 1, neutral: 2, success: 3, none: 4 };

export function normalizeState(status, conclusion) {
  if (status !== 'completed') return 'running';
  if (conclusion === 'success') return 'success';
  if (FAILURE_CONCLUSIONS.has(conclusion)) return 'failure';
  return 'neutral';
}

export function rankState(state) {
  return RANK[state] ?? RANK.none;
}

const REQUIRED_STRINGS = ['repo', 'actor', 'status'];

// Never throws: a bad file on the branch must degrade to a skipped entry, not
// take the whole read down. `at` is where the file was found, so a payload that
// disagrees with its own path is rejected rather than silently reattributed.
export function parseUpdate(raw, at) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `invalid JSON: ${err.message}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'not an object' };
  }
  for (const field of REQUIRED_STRINGS) {
    if (typeof parsed[field] !== 'string' || parsed[field] === '') {
      return { ok: false, reason: `missing or invalid "${field}"` };
    }
  }
  if (!Number.isInteger(parsed.runId)) {
    return { ok: false, reason: 'missing or invalid "runId"' };
  }
  if (parsed.actor !== at.login) {
    return { ok: false, reason: `actor "${parsed.actor}" does not match folder "${at.login}"` };
  }
  if (parsed.repo !== at.repo) {
    return { ok: false, reason: `repo "${parsed.repo}" does not match file "${at.repo}"` };
  }
  return { ok: true, update: parsed };
}

function repoName(env) {
  return env.GITHUB_REPOSITORY.split('/')[1];
}

// The workflow_run event carries the conclusion of the *whole* workflow, which
// is the only place `cancelled` is observable.
function fromWorkflowRun(env, run, now) {
  return {
    repo: repoName(env),
    actor: run.actor.login,
    runId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    workflow: run.name,
    branch: run.head_branch,
    event: run.event,
    url: run.html_url,
    startedAt: run.run_started_at,
    sentAt: now,
  };
}

// As a final `if: always()` step we only ever see our own job, and by
// definition it is finished, so status is pinned to completed and the
// conclusion comes from `job.status`.
function fromJob(env, now) {
  return {
    repo: repoName(env),
    actor: env.GITHUB_ACTOR,
    runId: Number(env.GITHUB_RUN_ID),
    status: 'completed',
    conclusion: env.JOB_STATUS,
    workflow: env.GITHUB_WORKFLOW,
    branch: env.GITHUB_REF_NAME,
    event: env.GITHUB_EVENT_NAME,
    url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    startedAt: now,
    sentAt: now,
  };
}

export function buildUpdate(env, event, now) {
  return env.GITHUB_EVENT_NAME === 'workflow_run'
    ? fromWorkflowRun(env, event.workflow_run, now)
    : fromJob(env, now);
}
