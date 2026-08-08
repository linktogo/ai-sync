<script setup>
import { computed } from 'vue';
import SessionRow from './SessionRow.vue';
import { STATUS_STYLES } from './statusStyles.js';

const props = defineProps({
  name: { type: String, required: true },
  sessions: { type: Array, required: true }, // [{ sessionId, title, lastPrompt, updatedAt, lastEvent, ... }]
  status: { type: String, required: true },
  now: { type: Number, default: () => Date.now() },
});
const emit = defineEmits(['open']);

const isQuestion = computed(() => props.status === 'question');
const style = computed(() => STATUS_STYLES[props.status]);

function open(sessionId) {
  emit('open', { name: props.name, sessionId });
}
</script>

<template>
  <div
    :class="['rounded-xl bg-white shadow-md p-3 border-l-4', style.border, isQuestion ? style.ring : '']"
  >
    <div class="font-medium text-slate-800">{{ name }}</div>
    <p v-if="sessions.length === 0" class="mt-1 text-xs text-slate-400">Aucune session active</p>
    <div v-else class="mt-2 flex flex-col gap-1.5">
      <SessionRow v-for="s in sessions" :key="s.sessionId" :session="s" :now="now" @open="open" />
    </div>
  </div>
</template>
