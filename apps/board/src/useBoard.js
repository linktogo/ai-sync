import { ref, onUnmounted } from 'vue';

export function useBoard({ intervalMs = 3000, fetchImpl = fetch } = {}) {
  const repos = ref({});
  const error = ref(null);

  async function refresh() {
    try {
      const res = await fetchImpl('/api/board');
      const data = await res.json();
      repos.value = data.repos ?? {};
      error.value = null;
    } catch (err) {
      error.value = err;
    }
  }

  refresh();
  const timer = setInterval(refresh, intervalMs);
  function stop() { clearInterval(timer); }
  onUnmounted(stop);

  return { repos, error, refresh, stop };
}
