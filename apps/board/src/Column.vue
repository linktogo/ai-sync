<script setup>
import Card from './Card.vue';
defineProps({
  title: { type: String, required: true },
  accent: { type: String, default: 'bg-slate-100' },
  entries: { type: Array, required: true }, // [{ name, repo }]
});
</script>

<template>
  <section class="flex-1 min-w-[14rem]">
    <h2 :class="['rounded-t-md px-3 py-2 text-sm font-semibold text-slate-700', accent]">
      {{ title }} <span class="text-slate-400">({{ entries.length }})</span>
    </h2>
    <div class="flex flex-col gap-2 bg-slate-50 p-2 rounded-b-md min-h-[4rem]">
      <Card v-for="e in entries" :key="e.name" :name="e.name" :repo="e.repo" />
    </div>
  </section>
</template>
