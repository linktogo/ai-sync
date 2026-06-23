<script setup>
import { onMounted, onUnmounted } from 'vue';
import { relativeTime } from './useRelativeTime.js';

const props = defineProps({
  name: { type: String, default: null },
  repo: { type: Object, default: null },
  meta: { type: Object, default: null },
  now: { type: Number, default: () => Date.now() },
});
const emit = defineEmits(['close']);

function onKey(e) { if (e.key === 'Escape') emit('close'); }
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div v-if="name" class="fixed inset-0 z-20">
    <div data-test="overlay" class="absolute inset-0 bg-slate-900/30" @click="emit('close')"></div>
    <aside class="absolute right-0 top-0 h-full w-80 bg-white shadow-xl p-4 overflow-y-auto">
      <button class="float-right text-slate-400 hover:text-slate-600" @click="emit('close')">✕</button>
      <h2 class="font-bold text-slate-800">{{ name }}</h2>
      <a v-if="meta?.url" :href="meta.url" target="_blank" rel="noopener"
         class="text-sm text-blue-600 underline break-all">{{ meta.url }}</a>
      <div v-if="meta" class="mt-2 flex flex-wrap gap-1">
        <span v-for="t in (meta.technologies || [])" :key="t" class="text-xs bg-slate-100 px-2 py-0.5 rounded">{{ t }}</span>
        <span v-for="t in (meta.targets || [])" :key="t" class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{{ t }}</span>
      </div>
      <h3 class="mt-4 text-xs font-semibold text-slate-500 uppercase">Historique</h3>
      <ul class="mt-1 space-y-1">
        <li v-for="(e, i) in (repo?.events || [])" :key="i" class="text-xs text-slate-600">
          • {{ e.event }} — {{ relativeTime(e.at, now) }}
        </li>
      </ul>
    </aside>
  </div>
</template>
