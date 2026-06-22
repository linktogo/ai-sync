<script setup>
defineProps({
  name: { type: String, default: '' },
  tech: { type: String, default: '' },
  technologies: { type: Array, default: () => [] },
});
defineEmits(['update:name', 'update:tech']);
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      data-test="search"
      :value="name"
      @input="$emit('update:name', $event.target.value)"
      placeholder="🔍 filtrer un repo…"
      class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white"
    />
    <select
      data-test="tech"
      :value="tech"
      @change="$emit('update:tech', $event.target.value)"
      class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white text-slate-600"
    >
      <option value="">techno : toutes</option>
      <option v-for="t in technologies" :key="t" :value="t">{{ t }}</option>
    </select>
  </div>
</template>
