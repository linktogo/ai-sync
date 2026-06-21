<script setup>
import { computed } from 'vue';
import Column from './Column.vue';
import { useBoard } from './useBoard.js';

const props = defineProps({
  fetchImpl: { type: Function, default: undefined },
  intervalMs: { type: Number, default: 3000 },
});

const { repos } = useBoard({ intervalMs: props.intervalMs, fetchImpl: props.fetchImpl ?? fetch });

const COLUMNS = [
  { status: 'todo', title: 'To do', accent: 'bg-slate-200' },
  { status: 'inprogress', title: 'In progress', accent: 'bg-blue-200' },
  { status: 'question', title: 'Question', accent: 'bg-amber-300' },
  { status: 'done', title: 'Done', accent: 'bg-emerald-200' },
];

function entriesFor(status) {
  return Object.entries(repos.value)
    .filter(([, r]) => r.status === status)
    .map(([name, repo]) => ({ name, repo }));
}

const grouped = computed(() => COLUMNS.map((c) => ({ ...c, entries: entriesFor(c.status) })));
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-4">
    <h1 class="text-lg font-bold text-slate-800 mb-4">ai-sync · workspace board</h1>
    <div class="flex gap-3">
      <Column v-for="c in grouped" :key="c.status" :title="c.title" :accent="c.accent" :entries="c.entries" />
    </div>
  </main>
</template>
