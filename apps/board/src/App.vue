<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useBoard } from './useBoard.js';
import { useConfig } from './useConfig.js';
import { useNotifications } from './useNotifications.js';
import { useNow } from './useRelativeTime.js';

const props = defineProps({
  fetchImpl: { type: Function, default: undefined },
  intervalMs: { type: Number, default: 3000 },
});
const fetchImpl = props.fetchImpl ?? fetch;

const { repos, transitions, connected, refresh } = useBoard({ intervalMs: props.intervalMs, fetchImpl });
const { repos: config } = useConfig({ fetchImpl });
const now = useNow();
const route = useRoute();

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

const routeProps = computed(() => (route.name === 'history'
  ? { fetchImpl }
  : { repos: repos.value, config: config.value, now: now.value, fetchImpl, refresh }));
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-6">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-slate-900">ai-sync · workspace board</h1>
        <div class="inline-flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 text-sm">
          <router-link
            data-test="view-board" to="/"
            :class="['rounded-md px-3 py-1 font-medium transition-colors', route.name === 'board' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700']"
          >Board</router-link>
          <router-link
            data-test="view-history" to="/history"
            :class="['rounded-md px-3 py-1 font-medium transition-colors', route.name === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700']"
          >Historique</router-link>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
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

    <router-view v-slot="{ Component }">
      <component :is="Component" v-bind="routeProps" />
    </router-view>
  </main>
</template>
