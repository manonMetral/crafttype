<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ApiError, type Api } from './api';
import type { Catalog, ModuleInfo, ProjectState } from './types';

const props = defineProps<{ api: Api | undefined }>();

const catalog = ref<Catalog>();
const project = ref<ProjectState>();
const problem = ref<{ message: string; hint?: string | undefined } | undefined>(
  props.api === undefined
    ? {
        message: 'No token.',
        hint: 'Open the address that crafttype ui printed or opened: it carries the token this page needs.',
      }
    : undefined,
);
const loading = computed(() => problem.value === undefined && catalog.value === undefined);

/** The modules by group, in the order the catalog lists them. */
const groups = computed(() => {
  const byName = new Map<string, ModuleInfo[]>();
  for (const module of catalog.value?.modules ?? []) {
    byName.set(module.group, [...(byName.get(module.group) ?? []), module]);
  }
  return [...byName].map(([name, modules]) => ({ name, modules }));
});

onMounted(async () => {
  if (props.api === undefined) {
    return;
  }
  try {
    [catalog.value, project.value] = await Promise.all([props.api.catalog(), props.api.project()]);
  } catch (error) {
    problem.value =
      error instanceof ApiError
        ? { message: error.message, hint: error.hint }
        : { message: error instanceof Error ? error.message : String(error) };
  }
});
</script>

<template>
  <header class="top">
    <h1>CraftType</h1>
    <p v-if="project" class="folder">
      Project <code>{{ project.projectFolder }}</code>
    </p>
  </header>
  <main>
    <p v-if="problem" role="alert" class="alert">
      <strong>Error:</strong> {{ problem.message }}
      <span v-if="problem.hint" class="hint">{{ problem.hint }}</span>
    </p>
    <p v-else-if="loading" role="status">Loading…</p>
    <template v-else>
      <section v-for="group in groups" :key="group.name">
        <h2>{{ group.name }}</h2>
        <ul>
          <li v-for="module in group.modules" :key="module.slug">
            <code>{{ module.slug }}</code> <span>{{ module.description }}</span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.top {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-primary);
}
.folder {
  margin: 0;
  color: var(--color-muted);
}
main {
  padding: 1.5rem;
}
.alert {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  color: var(--color-danger);
}
.hint {
  display: block;
  color: var(--color-muted);
}
</style>
