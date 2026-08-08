<script setup>
import { computed } from 'vue';
import Card from './Card.vue';
import { STATUS_STYLES } from './statusStyles.js';

const props = defineProps({
  title: { type: String, required: true },
  status: { type: String, required: true },
  entries: { type: Array, required: true }, // [{ name, sessions }]
  now: { type: Number, default: () => Date.now() },
});
defineEmits(['open']);

const style = computed(() => STATUS_STYLES[props.status]);
</script>

<template>
  <section class="min-w-0">
    <h2 :class="['inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white mb-2', style.pill]">
      {{ title }} <span class="opacity-80">({{ entries.length }})</span>
    </h2>
    <div class="flex flex-col gap-2 bg-white/50 rounded-xl p-2 min-h-[4rem]">
      <Card v-for="e in entries" :key="e.name" :name="e.name" :sessions="e.sessions" :status="status" :now="now" @open="$emit('open', $event)" />
    </div>
  </section>
</template>
