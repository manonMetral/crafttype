<script setup lang="ts">
import { onMounted, ref } from 'vue';

const status = ref('...');

onMounted(async () => {
  try {
    const response = await fetch('/api/health');
    status.value = (await response.json()).status;
  } catch {
    status.value = 'unavailable';
  }
});
</script>

<template>
  <main>
    <h1>Welcome</h1>
    <p>Server status: {{ status }}</p>
    <!-- crafttype-needle-app-template -->
  </main>
</template>
