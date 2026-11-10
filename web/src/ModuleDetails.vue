<script setup lang="ts">
import { listNeeds, type Exclusion } from './basket';
import type { ModuleInfo } from './types';
import styles from './ModuleDetails.module.css';

const props = defineProps<{
  module: ModuleInfo | undefined;
  /** The whole catalog, to know which modules bring a capability this one requires. */
  modules: readonly ModuleInfo[];
  applied: ReadonlySet<string>;
  inBasket: ReadonlySet<string>;
  /** What putting this module in the basket would bring with it: the prerequisites the project does not have. */
  alsoAdds: readonly string[];
  /** The module that brings a capability this one provides already: this one cannot be added. */
  excludedBy: Exclusion | undefined;
}>();
defineEmits<{ toggle: [slug: string] }>();

const STATUS_LABEL = { applied: 'applied', 'in-basket': 'in basket', missing: 'missing' } as const;

const needsOf = (module: ModuleInfo) => listNeeds({ modules: props.modules }, props.applied, props.inBasket, module);
</script>

<template>
  <section :class="styles.details" aria-label="Module details">
    <p v-if="module === undefined" :class="styles.placeholder">
      Choose a module to see what it adds and what it needs.
    </p>
    <template v-else>
      <h2>{{ module.slug }}</h2>
      <p :class="styles.group">{{ module.group }}</p>
      <p>{{ module.description }}</p>
      <p v-if="module.tags.length > 0">
        <span v-for="tag in module.tags" :key="tag" :class="styles.tag">{{ tag }}</span>
      </p>

      <h3>Prerequisites</h3>
      <p v-if="needsOf(module).length === 0">Needs nothing.</p>
      <ul v-else>
        <li v-for="need in needsOf(module)" :key="need.name" :class="styles.need" :data-status="need.status">
          <code>{{ need.name }}</code> ({{ STATUS_LABEL[need.status] }})
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
      <p v-else-if="excludedBy" :class="styles.excluded">
        Cannot be added: {{ excludedBy.capability }} is already provided by {{ excludedBy.by }}.
      </p>
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
