import { ref, onUnmounted } from 'vue';

export function useCi({ intervalMs = 30000, fetchImpl = fetch } = {}) {
  const repos = ref({});
  const syncError = ref(null);

  async function refresh() {
    try {
      const res = await fetchImpl('/api/ci');
      const data = await res.json();
      repos.value = data.repos ?? {};
      syncError.value = data.lastSyncError ?? null;
    } catch {
      // Keep the last known statuses: a dead poll is not evidence CI changed.
      syncError.value = 'injoignable';
    }
  }

  refresh();
  const timer = setInterval(refresh, intervalMs);
  function stop() { clearInterval(timer); }
  onUnmounted(stop);

  return { repos, syncError, refresh, stop };
}
