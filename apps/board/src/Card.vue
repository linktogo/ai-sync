<script setup>
defineProps({ name: { type: String, required: true }, repo: { type: Object, required: true } });
</script>

<template>
  <div class="rounded-md bg-white shadow-sm border border-slate-200 p-3">
    <div class="font-medium text-slate-800">{{ name }}</div>
    <div class="mt-1 text-xs text-slate-500">{{ repo.lastEvent }} · {{ repo.updatedAt }}</div>
  </div>
</template>
