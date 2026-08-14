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
      syncError.value = 'injoignable';
    }
  }

  refresh();
  const timer = setInterval(refresh, intervalMs);
  function stop() { clearInterval(timer); }
  onUnmounted(stop);

  return { repos, syncError, refresh, stop };
}
