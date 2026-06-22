import { ref, onUnmounted } from 'vue';

const NOTIFY_STATES = ['question', 'done'];

function diffTransitions(prev, next) {
  const out = [];
  for (const [name, r] of Object.entries(next)) {
    if (NOTIFY_STATES.includes(r.status) && prev[name]?.status !== r.status) {
      out.push({ name, status: r.status });
    }
  }
  return out;
}

export function useBoard({ intervalMs = 3000, fetchImpl = fetch } = {}) {
  const repos = ref({});
  const error = ref(null);
  const transitions = ref([]);
  const connected = ref(true);
  let prev = null; // null until the first successful fetch establishes a baseline

  async function refresh() {
    try {
      const res = await fetchImpl('/api/board');
      const data = await res.json();
      const next = data.repos ?? {};
      transitions.value = prev ? diffTransitions(prev, next) : [];
      prev = next;
      repos.value = next;
      error.value = null;
      connected.value = true;
    } catch (err) {
      error.value = err;
      connected.value = false;
    }
  }

  refresh();
  const timer = setInterval(refresh, intervalMs);
  function stop() { clearInterval(timer); }
  onUnmounted(stop);

  return { repos, error, transitions, connected, refresh, stop };
}
