<script setup>
import { computed } from 'vue';
import { relativeTime } from './useRelativeTime.js';
import { visibleBadges, pillClass } from './ciBadge.js';

const props = defineProps({
  name: { type: String, required: true },
  repo: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
  ci: { type: Object, default: null },
});
defineEmits(['open']);

const isQuestion = computed(() => props.repo.status === 'question');
const when = computed(() => relativeTime(props.repo.updatedAt, props.now));
const badges = computed(() => visibleBadges(props.ci?.users));
const overflowTitle = computed(() => badges.value.overflow.map((b) => `${b.login} — ${b.state}`).join('\n'));
</script>

<template>
  <button
    type="button"
    @click="$emit('open', name)"
    :class="['w-full text-left rounded-md bg-white shadow-sm border p-3 transition',
             isQuestion ? 'border-amber-400 ring-4 ring-amber-200' : 'border-slate-200 hover:border-slate-300']"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="font-medium text-slate-800 min-w-0 truncate">{{ name }}</div>
      <div class="flex items-center gap-1 shrink-0">
        <span
          v-for="b in badges.shown" :key="b.login"
          data-test="ci-badge"
          role="img"
          :title="`${b.login} — ${b.state}`"
          :aria-label="`${b.login} — ${b.state}`"
          :class="['text-[10px] leading-none font-semibold border rounded px-1 py-0.5', pillClass(b.state)]"
        >{{ b.initials }}</span>
        <span
          v-if="badges.overflow.length"
          data-test="ci-overflow"
          role="img"
          :title="overflowTitle"
          :aria-label="overflowTitle"
          class="text-[10px] leading-none font-semibold border border-slate-300 bg-slate-100 text-slate-500 rounded px-1 py-0.5"
        >+{{ badges.overflow.length }}</span>
      </div>
    </div>
    <div class="mt-1 text-xs text-slate-500">{{ repo.lastEvent }} · {{ when }}</div>
  </button>
</template>
