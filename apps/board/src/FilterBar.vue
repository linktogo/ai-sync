<script setup>
defineProps({
  name: { type: String, default: '' },
  tech: { type: String, default: '' },
  ci: { type: String, default: '' },
  technologies: { type: Array, default: () => [] },
});
defineEmits(['update:name', 'update:tech', 'update:ci']);
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <input
      data-test="search"
      :value="name"
      @input="$emit('update:name', $event.target.value)"
      placeholder="🔍 filtrer un repo…"
      class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white flex-1 min-w-0"
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
    <select
      data-test="ci"
      :value="ci"
      @change="$emit('update:ci', $event.target.value)"
      class="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white text-slate-600"
    >
      <option value="">CI : tous</option>
      <option value="failure">en échec</option>
      <option value="ok">OK</option>
      <option value="unknown">inconnu</option>
    </select>
  </div>
</template>
