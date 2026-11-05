<script setup lang="ts">
import { computed } from 'vue';
import type { ModuleInfo } from './types';

const props = defineProps<{
  module: ModuleInfo | undefined;
  applied: ReadonlySet<string>;
  inBasket: ReadonlySet<string>;
  /** What putting this module in the basket would bring with it: the prerequisites the project does not have. */
  alsoAdds: readonly string[];
}>();
defineEmits<{ toggle: [slug: string] }>();

const STATUS_LABEL = { applied: 'applied', 'in-basket': 'in basket', missing: 'missing' } as const;

const needs = computed(() =>
  (props.module?.dependsOn ?? []).map((slug) => {
    const status = props.applied.has(slug) ? 'applied' : props.inBasket.has(slug) ? 'in-basket' : 'missing';
    return { slug, status, label: STATUS_LABEL[status] };
  }),
);
</script>

<template>
  <section class="details" aria-label="Module details">
    <p v-if="module === undefined" class="placeholder">
      Choose a module in the tree to see what it adds and what it needs.
    </p>
    <template v-else>
      <h2>{{ module.slug }}</h2>
      <p class="group">{{ module.group }}</p>
      <p>{{ module.description }}</p>
      <p v-if="module.tags.length > 0" class="tags">
        <span v-for="tag in module.tags" :key="tag" class="tag">{{ tag }}</span>
      </p>

      <h3>Prerequisites</h3>
      <p v-if="needs.length === 0">Needs nothing.</p>
      <ul v-else>
        <li v-for="need in needs" :key="need.slug" class="need" :data-status="need.status">
          <code>{{ need.slug }}</code> ({{ need.label }})
        </li>
      </ul>

      <h3>Options</h3>
      <p v-if="module.properties.length === 0">No option.</p>
      <ul v-else>
        <li v-for="property in module.properties" :key="property.key" class="option">
          <code>{{ property.key }}</code>
          <span class="type">{{ property.type }}</span>
          <strong v-if="property.mandatory" class="required">required</strong>
          <span class="description">{{ property.description }}</span>
        </li>
      </ul>

      <p v-if="applied.has(module.slug)" class="applied">This module is already applied in the project.</p>
      <template v-else>
        <p v-if="alsoAdds.length > 0 && !inBasket.has(module.slug)" class="also">
          It also adds what it needs and the project does not have: {{ alsoAdds.join(', ') }}.
        </p>
        <button type="button" class="primary" @click="$emit('toggle', module.slug)">
          {{ inBasket.has(module.slug) ? 'Remove from basket' : 'Add to basket' }}
        </button>
      </template>
    </template>
  </section>
</template>

<style scoped>
.details h2 {
  margin: 0;
  font-family: var(--font-mono);
}
.details h3 {
  margin: 1.25rem 0 0.25rem;
  font-size: 1rem;
  color: var(--color-muted);
}
.group {
  margin: 0;
  color: var(--color-muted);
}
.placeholder {
  color: var(--color-muted);
}
.tag {
  margin-right: 0.5rem;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.8125rem;
}
ul {
  margin: 0;
  padding-left: 1.25rem;
}
.need[data-status='missing'] {
  text-decoration: underline dashed;
}
.type,
.description {
  margin-left: 0.5rem;
  color: var(--color-muted);
}
.required {
  margin-left: 0.5rem;
  color: var(--color-primary-strong);
}
.also,
.applied {
  margin-top: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
.applied {
  background: var(--color-surface);
  color: var(--color-muted);
}
button.primary {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  cursor: pointer;
}
button.primary:hover {
  background: var(--color-primary-strong);
}
</style>
