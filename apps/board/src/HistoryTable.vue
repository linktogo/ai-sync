<script setup>
import { ref, computed } from 'vue';
import { formatTokens } from './formatTokens.js';

const props = defineProps({
  entries: { type: Array, required: true },
});

const repoFilter = ref('');
const sortKey = ref('endedAt');
const sortDir = ref('desc');

function totalOf(entry) {
  const u = entry.usage ?? { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };
  return u.inputTokens + u.outputTokens + u.cacheCreationInputTokens + u.cacheReadInputTokens;
}

function durationLabel(entry) {
  if (!entry.startedAt || !entry.endedAt) return '';
  const ms = new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime();
  return `${Math.max(0, Math.round(ms / 60000))} min`;
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

function valueFor(entry, key) {
  if (key === 'total') return totalOf(entry);
  return entry[key] ?? '';
}

const rows = computed(() => {
  const filtered = props.entries.filter(
    (e) => !repoFilter.value || e.repo.toLowerCase().includes(repoFilter.value.toLowerCase()),
  );
  return [...filtered].sort((a, b) => {
    const av = valueFor(a, sortKey.value);
    const bv = valueFor(b, sortKey.value);
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1;
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1;
    return 0;
  });
});
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
    <input
      data-test="history-repo-filter"
      v-model="repoFilter"
      placeholder="🔍 filtrer un repo…"
      class="border border-slate-200 rounded-lg shadow-sm px-3 py-1.5 text-sm bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
    />
    <table class="w-full text-sm text-left">
      <thead>
        <tr class="text-slate-500 bg-slate-50 uppercase tracking-wide text-xs border-b border-slate-200">
          <th class="py-2 px-3 cursor-pointer" data-test="sort-repo" @click="sortBy('repo')">Repo</th>
          <th class="py-2 px-3 cursor-pointer" data-test="sort-title" @click="sortBy('title')">Titre</th>
          <th class="py-2 px-3">Démarrée</th>
          <th class="py-2 px-3">Terminée</th>
          <th class="py-2 px-3">Durée</th>
          <th class="py-2 px-3 text-right">Input</th>
          <th class="py-2 px-3 text-right">Output</th>
          <th class="py-2 px-3 text-right">Cache écrit</th>
          <th class="py-2 px-3 text-right">Cache lu</th>
          <th class="py-2 px-3 text-right cursor-pointer" data-test="sort-total" @click="sortBy('total')">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in rows" :key="`${e.repo}-${e.sessionId}`" data-test="history-row" class="border-b border-slate-100 odd:bg-slate-50/60 hover:bg-slate-50">
          <td class="py-1.5 px-3">{{ e.repo }}</td>
          <td class="py-1.5 px-3">{{ e.title ?? '(sans titre)' }}</td>
          <td class="py-1.5 px-3">{{ e.startedAt }}</td>
          <td class="py-1.5 px-3">{{ e.endedAt }}</td>
          <td class="py-1.5 px-3">{{ durationLabel(e) }}</td>
          <td class="py-1.5 px-3 text-right">{{ e.usage?.inputTokens ?? 0 }}</td>
          <td class="py-1.5 px-3 text-right">{{ e.usage?.outputTokens ?? 0 }}</td>
          <td class="py-1.5 px-3 text-right">{{ e.usage?.cacheCreationInputTokens ?? 0 }}</td>
          <td class="py-1.5 px-3 text-right">{{ e.usage?.cacheReadInputTokens ?? 0 }}</td>
          <td class="py-1.5 px-3 text-right">
            <span class="inline-block bg-slate-100 rounded px-1.5 py-0.5 font-semibold">{{ formatTokens(totalOf(e)) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="rows.length === 0" class="text-xs text-slate-400 mt-2">Aucune session terminée pour l'instant.</p>
  </div>
</template>
