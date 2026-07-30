import { rankState } from '@ai-sync/ci-status';

const MAX_BADGES = 4;

const PILL = {
  failure: 'bg-red-100 text-red-700 border-red-300',
  running: 'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
  neutral: 'bg-slate-100 text-slate-600 border-slate-300',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

export function initials(login) {
  const parts = login.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function pillClass(state) {
  return PILL[state] ?? PILL.neutral;
}

// Worst first, so a failure is always among the badges that survive the cap.
export function visibleBadges(users, max = MAX_BADGES) {
  const all = Object.entries(users ?? {})
    .map(([login, u]) => ({ login, state: u.state, initials: initials(login) }))
    .sort((a, b) => rankState(a.state) - rankState(b.state) || a.login.localeCompare(b.login));
  return { shown: all.slice(0, max), overflow: all.slice(max) };
}

export function ciAggregate(users) {
  const states = Object.values(users ?? {}).map((u) => u.state);
  if (states.length === 0) return 'unknown';
  if (states.includes('failure')) return 'failure';
  if (states.includes('running')) return 'running';
  return 'ok';
}

export function matchesCiFilter(users, filter) {
  if (!filter) return true;
  return ciAggregate(users) === filter;
}
