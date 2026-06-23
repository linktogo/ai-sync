import { ref, onUnmounted } from 'vue';

export function relativeTime(iso, nowMs = Date.now()) {
  if (!iso) return '';
  const diff = Math.max(0, nowMs - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// Reactive "now" that updates on an interval, for live-refreshing relative times.
export function useNow(intervalMs = 1000) {
  const now = ref(Date.now());
  const timer = setInterval(() => { now.value = Date.now(); }, intervalMs);
  onUnmounted(() => clearInterval(timer));
  return now;
}
