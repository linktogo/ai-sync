<script setup>
import { computed } from 'vue';

const props = defineProps({ repos: { type: Object, required: true } });

const counts = computed(() => {
  const c = { todo: 0, inprogress: 0, question: 0, done: 0 };
  for (const r of Object.values(props.repos)) if (c[r.status] !== undefined) c[r.status] += 1;
  return c;
});
const total = computed(() => Object.keys(props.repos).length);
const percentDone = computed(() => (total.value ? Math.round((counts.value.done / total.value) * 100) : 0));
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4">
    <div class="flex flex-wrap gap-4 text-sm text-slate-600 mb-2">
      <span><b class="text-slate-800">{{ total }}</b> repos</span>
      <span>· <b>{{ counts.todo }}</b> To do</span>
      <span>· <b>{{ counts.inprogress }}</b> In progress</span>
      <span class="text-amber-700">· <b>{{ counts.question }}</b> Question</span>
      <span class="text-emerald-700">· <b>{{ counts.done }}</b> Done</span>
    </div>
    <div class="h-2 bg-slate-200 rounded overflow-hidden">
      <div data-test="progress" class="h-full bg-emerald-500" :style="{ width: percentDone + '%' }"></div>
    </div>
    <div class="text-xs text-slate-400 mt-1">{{ percentDone }} % terminé</div>
  </div>
</template>
