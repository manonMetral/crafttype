<script setup lang="ts">
import { computed } from 'vue';
import type { ModuleInfo } from './types';
import styles from './ModuleDetails.module.css';

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
  <section :class="styles.details" aria-label="Module details">
    <p v-if="module === undefined" :class="styles.placeholder">
      Choose a module in the tree to see what it adds and what it needs.
    </p>
    <template v-else>
      <h2>{{ module.slug }}</h2>
      <p :class="styles.group">{{ module.group }}</p>
      <p>{{ module.description }}</p>
      <p v-if="module.tags.length > 0">
        <span v-for="tag in module.tags" :key="tag" :class="styles.tag">{{ tag }}</span>
      </p>

      <h3>Prerequisites</h3>
      <p v-if="needs.length === 0">Needs nothing.</p>
      <ul v-else>
        <li v-for="need in needs" :key="need.slug" :class="styles.need" :data-status="need.status">
          <code>{{ need.slug }}</code> ({{ need.label }})
        </li>
      </ul>

      <h3>Options</h3>
      <p v-if="module.properties.length === 0">No option.</p>
      <ul v-else>
        <li v-for="property in module.properties" :key="property.key">
          <code>{{ property.key }}</code>
          <span :class="styles.type">{{ property.type }}</span>
          <strong v-if="property.mandatory" :class="styles.required">required</strong>
          <span :class="styles.description">{{ property.description }}</span>
        </li>
      </ul>

      <p v-if="applied.has(module.slug)" :class="styles.applied">This module is already applied in the project.</p>
      <template v-else>
        <p v-if="alsoAdds.length > 0 && !inBasket.has(module.slug)" :class="styles.also">
          It also adds what it needs and the project does not have: {{ alsoAdds.join(', ') }}.
        </p>
        <button type="button" :class="styles.primary" @click="$emit('toggle', module.slug)">
          {{ inBasket.has(module.slug) ? 'Remove from basket' : 'Add to basket' }}
        </button>
      </template>
    </template>
  </section>
</template>
