<script setup>
import { computed, ref } from 'vue';
import Column from './Column.vue';
import SummaryHeader from './SummaryHeader.vue';
import FilterBar from './FilterBar.vue';
import RepoDetail from './RepoDetail.vue';
import { useBoard } from './useBoard.js';
import { useConfig } from './useConfig.js';
import { useNotifications } from './useNotifications.js';
import { useNow } from './useRelativeTime.js';

const props = defineProps({
  fetchImpl: { type: Function, default: undefined },
  intervalMs: { type: Number, default: 3000 },
});
const fetchImpl = props.fetchImpl ?? fetch;

const { repos, transitions, connected } = useBoard({ intervalMs: props.intervalMs, fetchImpl });
const { repos: config } = useConfig({ fetchImpl });
const now = useNow();

const nameFilter = ref('');
const techFilter = ref('');
const selected = ref(null);

const questionCount = computed(() => Object.values(repos.value).filter((r) => r.status === 'question').length);
const { permission, soundOn, requestPermission, toggleSound } = useNotifications(transitions, questionCount, {});

const technologies = computed(() => {
  const set = new Set();
  for (const meta of Object.values(config.value)) for (const t of meta.technologies ?? []) set.add(t);
  return [...set].sort();
});

const COLUMNS = [
  { status: 'todo', title: 'To do', accent: 'bg-slate-200' },
  { status: 'inprogress', title: 'In progress', accent: 'bg-blue-200' },
  { status: 'question', title: 'Question', accent: 'bg-amber-300' },
  { status: 'done', title: 'Done', accent: 'bg-emerald-200' },
];

const filtered = computed(() => {
  const out = {};
  for (const [name, repo] of Object.entries(repos.value)) {
    if (nameFilter.value && !name.toLowerCase().includes(nameFilter.value.toLowerCase())) continue;
    if (techFilter.value && !(config.value[name]?.technologies ?? []).includes(techFilter.value)) continue;
    out[name] = repo;
  }
  return out;
});

function entriesFor(status) {
  return Object.entries(filtered.value)
    .filter(([, r]) => r.status === status)
    .map(([name, repo]) => ({ name, repo }));
}
const grouped = computed(() => COLUMNS.map((c) => ({ ...c, entries: entriesFor(c.status) })));

const selectedRepo = computed(() => (selected.value ? repos.value[selected.value] : null));
const selectedMeta = computed(() => (selected.value ? config.value[selected.value] ?? null : null));
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-4">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <h1 class="text-lg font-bold text-slate-800">ai-sync · workspace board</h1>
      <div class="flex items-center gap-2 flex-wrap">
        <FilterBar
          :name="nameFilter" :tech="techFilter" :technologies="technologies"
          @update:name="nameFilter = $event" @update:tech="techFilter = $event"
        />
        <button
          v-if="permission !== 'granted'"
          class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white"
          @click="requestPermission"
        >🔔 activer</button>
        <button
          class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white"
          :class="soundOn ? 'text-slate-700' : 'text-slate-400'"
          @click="toggleSound"
        >{{ soundOn ? '🔊' : '🔇' }} son</button>
      </div>
    </div>

    <p v-if="!connected" class="mb-3 text-xs text-amber-700">⚠ déconnecté — nouvelle tentative au prochain poll…</p>
    <p v-if="permission === 'denied'" class="mb-3 text-xs text-slate-500">Notifications bloquées par le navigateur.</p>

    <SummaryHeader :repos="repos" />

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Column
        v-for="c in grouped" :key="c.status"
        :title="c.title" :accent="c.accent" :entries="c.entries" :now="now"
        @open="selected = $event"
      />
    </div>

    <RepoDetail
      :name="selected" :repo="selectedRepo" :meta="selectedMeta" :now="now"
      @close="selected = null"
    />
  </main>
</template>
