<script setup lang="ts">
import { onMounted, ref } from 'vue';

const status = ref('...');

onMounted(async () => {
  try {
    const response = await fetch('/api/health');
    status.value = (await response.json()).status;
  } catch {
    status.value = 'indisponible';
  }
});
</script>

<template>
  <main>
    <h1>Bienvenue</h1>
    <p>État du serveur : {{ status }}</p>
    <!-- crafttype-needle-app-template -->
  </main>
</template>
