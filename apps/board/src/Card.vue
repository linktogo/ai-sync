<script setup>
import { computed } from 'vue';
import { relativeTime } from './useRelativeTime.js';

const props = defineProps({
  name: { type: String, required: true },
  repo: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
});
defineEmits(['open']);

const isQuestion = computed(() => props.repo.status === 'question');
const when = computed(() => relativeTime(props.repo.updatedAt, props.now));
</script>

<template>
  <button
    type="button"
    @click="$emit('open', name)"
    :class="['w-full text-left rounded-md bg-white shadow-sm border p-3 transition',
             isQuestion ? 'border-amber-400 ring-4 ring-amber-200' : 'border-slate-200 hover:border-slate-300']"
  >
    <div class="font-medium text-slate-800">{{ name }}</div>
    <div class="mt-1 text-xs text-slate-500">{{ repo.lastEvent }} · {{ when }}</div>
  </button>
</template>
