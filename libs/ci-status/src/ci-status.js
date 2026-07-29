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
