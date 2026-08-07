<script setup>
import { computed } from 'vue';
import SessionRow from './SessionRow.vue';

const props = defineProps({
  name: { type: String, required: true },
  sessions: { type: Array, required: true }, // [{ sessionId, title, lastPrompt, updatedAt, lastEvent, ... }]
  status: { type: String, required: true },
  now: { type: Number, default: () => Date.now() },
});
const emit = defineEmits(['open']);

const isQuestion = computed(() => props.status === 'question');

function open(sessionId) {
  emit('open', { name: props.name, sessionId });
}
</script>

<template>
  <div
    :class="['rounded-md bg-white shadow-sm border p-3',
             isQuestion ? 'border-amber-400 ring-4 ring-amber-200' : 'border-slate-200']"
  >
    <div class="font-medium text-slate-800">{{ name }}</div>
    <p v-if="sessions.length === 0" class="mt-1 text-xs text-slate-400">Aucune session active</p>
    <div v-else class="mt-2 flex flex-col divide-y divide-slate-100">
      <SessionRow v-for="s in sessions" :key="s.sessionId" :session="s" :now="now" @open="open" />
    </div>
  </div>
</template>
