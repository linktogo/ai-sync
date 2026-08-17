<script setup>
import { ref, computed } from 'vue';
import { relativeTime } from './useRelativeTime.js';
import { formatTokens } from './formatTokens.js';
import { useI18n } from './i18n.js';

const { t } = useI18n();

const PROMPT_CLIP = 140;

const props = defineProps({
  session: { type: Object, required: true },
  repoName: { type: String, default: '' },
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

const usage = computed(() => props.session.usage ?? null);
const totalTokens = computed(() => {
  if (!usage.value) return 0;
  const u = usage.value;
  return u.inputTokens + u.outputTokens + u.cacheCreationInputTokens + u.cacheReadInputTokens;
});
const usageTooltip = computed(() => {
  if (!usage.value) return '';
  const u = usage.value;
  return t('session.usageTooltip', {
    input: u.inputTokens,
    output: u.outputTokens,
    cacheWrite: u.cacheCreationInputTokens,
    cacheRead: u.cacheReadInputTokens,
  });
});

function open() { emit('open', props.session.sessionId); }
function toggle(e) { e.stopPropagation(); expanded.value = !expanded.value; }
function onDragStart(e) {
  e.dataTransfer.setData('application/json', JSON.stringify({ repo: props.repoName, sessionId: props.session.sessionId }));
  e.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    data-test="session-row"
    draggable="true"
    class="bg-slate-50 hover:bg-slate-100 rounded-lg p-2 cursor-grab active:cursor-grabbing transition-colors"
    @click="open"
    @keydown.enter="open"
    @keydown.space.prevent="open"
    @dragstart="onDragStart"
  >
    <div class="font-medium text-slate-800 text-sm truncate">{{ session.title ?? t('session.untitled') }}</div>
    <div class="text-xs text-slate-500">
      {{ session.lastEvent }} · {{ when }}
      <span v-if="usage" data-test="token-badge" :title="usageTooltip" class="inline-block ml-1 bg-slate-200/70 text-slate-600 font-medium px-1.5 py-0.5 rounded">{{ t('session.tokens', { count: formatTokens(totalTokens) }) }}</span>
    </div>
    <p v-if="prompt" class="mt-1 text-xs text-slate-600 whitespace-pre-wrap">
      {{ displayedPrompt }}
      <button
        v-if="overflows"
        type="button"
        data-test="toggle-prompt"
        class="text-blue-600 hover:underline"
        @click="toggle"
      >{{ expanded ? t('session.showLess') : t('session.showMore') }}</button>
    </p>
  </div>
</template>
