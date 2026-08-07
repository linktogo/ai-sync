<script setup>
import { ref, computed } from 'vue';
import { relativeTime } from './useRelativeTime.js';

const PROMPT_CLIP = 140;

const props = defineProps({
  session: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
});
const emit = defineEmits(['open']);

const expanded = ref(false);
const when = computed(() => relativeTime(props.session.updatedAt, props.now));
const prompt = computed(() => props.session.lastPrompt ?? '');
const overflows = computed(() => prompt.value.length > PROMPT_CLIP);
const displayedPrompt = computed(() => (
  expanded.value || !overflows.value ? prompt.value : `${prompt.value.slice(0, PROMPT_CLIP)}…`
));

function open() { emit('open', props.session.sessionId); }
function toggle(e) { e.stopPropagation(); expanded.value = !expanded.value; }
</script>

<template>
  <div
    role="button"
    tabindex="0"
    data-test="session-row"
    class="py-1.5 cursor-pointer"
    @click="open"
    @keydown.enter="open"
    @keydown.space.prevent="open"
  >
    <div class="font-medium text-slate-800 text-sm truncate">{{ session.title ?? '(sans titre)' }}</div>
    <div class="text-xs text-slate-500">{{ session.lastEvent }} · {{ when }}</div>
    <p v-if="prompt" class="mt-1 text-xs text-slate-600 whitespace-pre-wrap">
      {{ displayedPrompt }}
      <button
        v-if="overflows"
        type="button"
        data-test="toggle-prompt"
        class="text-blue-600 hover:underline"
        @click="toggle"
      >{{ expanded ? 'voir moins' : 'voir plus' }}</button>
    </p>
  </div>
</template>
