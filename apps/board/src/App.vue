<script setup>
import { computed, ref } from 'vue';
import Column from './Column.vue';
import SummaryHeader from './SummaryHeader.vue';
import FilterBar from './FilterBar.vue';
import RepoDetail from './RepoDetail.vue';
import HistoryView from './HistoryView.vue';
import { useBoard } from './useBoard.js';
import { useConfig } from './useConfig.js';
import { useNotifications } from './useNotifications.js';
import { useHistory } from './useHistory.js';
import { useNow } from './useRelativeTime.js';
import { STATUS_ORDER, STATUS_STYLES } from './statusStyles.js';

const props = defineProps({
  fetchImpl: { type: Function, default: undefined },
  intervalMs: { type: Number, default: 3000 },
});
const fetchImpl = props.fetchImpl ?? fetch;

const { repos, transitions, connected, refresh } = useBoard({ intervalMs: props.intervalMs, fetchImpl });
const { repos: config } = useConfig({ fetchImpl });
const now = useNow();

const nameFilter = ref('');
const techFilter = ref('');
const selected = ref(null); // { name, sessionId } | null

const questionCount = computed(() => {
  let n = 0;
  for (const repoEntry of Object.values(repos.value)) {
    for (const s of Object.values(repoEntry.sessions ?? {})) {
      if (s.status === 'question') n += 1;
    }
  }
  return n;
});
const { permission, soundOn, requestPermission, toggleSound } = useNotifications(transitions, questionCount, {});
const { entries: historyEntries, load: loadHistory } = useHistory({ fetchImpl });
const view = ref('board');

const technologies = computed(() => {
  const set = new Set();
  for (const meta of Object.values(config.value)) for (const t of meta.technologies ?? []) set.add(t);
  return [...set].sort();
});

const COLUMNS = STATUS_ORDER.map((status) => ({ status, title: STATUS_STYLES[status].label }));

const filtered = computed(() => {
  const out = {};
  for (const [name, repo] of Object.entries(repos.value)) {
    if (nameFilter.value && !name.toLowerCase().includes(nameFilter.value.toLowerCase())) continue;
    if (techFilter.value && !(config.value[name]?.technologies ?? []).includes(techFilter.value)) continue;
    out[name] = repo;
  }
  return out;
});

// A repo's card shows up in every column that has at least one of its
// sessions; each column's copy lists only that column's sessions. A repo
// with no sessions at all still shows a placeholder card in "todo".
function entriesFor(status) {
  const out = [];
  for (const [name, repoEntry] of Object.entries(filtered.value)) {
    const allSessions = Object.entries(repoEntry.sessions ?? {});
    if (allSessions.length === 0) {
      if (status === 'todo') out.push({ name, sessions: [] });
      continue;
    }
    const sessions = allSessions
      .filter(([, s]) => s.status === status)
      .map(([sessionId, s]) => ({ sessionId, ...s }));
    if (sessions.length > 0) out.push({ name, sessions });
  }
  return out;
}
const grouped = computed(() => COLUMNS.map((c) => ({ ...c, entries: entriesFor(c.status) })));

async function onCloseSession({ repo, sessionId }) {
  const label = repos.value[repo]?.sessions?.[sessionId]?.title ?? sessionId;
  if (!window.confirm(`Marquer la session « ${label} » de ${repo} comme terminée ?`)) return;
  await fetchImpl('/api/sessions/close', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo, sessionId }),
  });
  await refresh();
}

const selectedRepo = computed(() => (selected.value ? repos.value[selected.value.name] : null));
const selectedSession = computed(() => selectedRepo.value?.sessions?.[selected.value?.sessionId] ?? null);
const selectedMeta = computed(() => (selected.value ? config.value[selected.value.name] ?? null : null));
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-6">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-slate-900">ai-sync · workspace board</h1>
        <div class="inline-flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 text-sm">
          <button
            data-test="view-board"
            :class="['rounded-md px-3 py-1 font-medium transition-colors', view === 'board' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700']"
            @click="view = 'board'"
          >Board</button>
          <button
            data-test="view-history"
            :class="['rounded-md px-3 py-1 font-medium transition-colors', view === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700']"
            @click="view = 'history'; loadHistory()"
          >Historique</button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <FilterBar
          v-if="view === 'board'"
          :name="nameFilter" :tech="techFilter" :technologies="technologies"
          @update:name="nameFilter = $event" @update:tech="techFilter = $event"
        />
        <button
          v-if="permission !== 'granted'"
          class="border border-slate-200 rounded-lg shadow-sm hover:shadow px-3 py-1.5 text-sm bg-white"
          @click="requestPermission"
        >🔔 activer</button>
        <button
          class="border border-slate-200 rounded-lg shadow-sm hover:shadow px-3 py-1.5 text-sm bg-white"
          :class="soundOn ? 'text-slate-700' : 'text-slate-400'"
          @click="toggleSound"
        >{{ soundOn ? '🔊' : '🔇' }} son</button>
      </div>
    </div>

    <p v-if="!connected" class="mb-3 text-xs text-amber-700">⚠ déconnecté — nouvelle tentative au prochain poll…</p>
    <p v-if="permission === 'denied'" class="mb-3 text-xs text-slate-500">Notifications bloquées par le navigateur.</p>

    <template v-if="view === 'board'">
      <SummaryHeader :repos="repos" />

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Column
          v-for="c in grouped" :key="c.status"
          :title="c.title" :status="c.status" :entries="c.entries" :now="now"
          @open="selected = $event"
          @close-session="onCloseSession"
        />
      </div>

      <RepoDetail
        :name="selected?.name ?? null" :session="selectedSession" :meta="selectedMeta" :now="now"
        @close="selected = null"
      />
    </template>
    <HistoryView v-else :entries="historyEntries" />
  </main>
</template>
