<script setup lang="ts">
import type { SharedProperty } from './basket';
import type { ConflictPolicy, PropertyValue } from './types';

defineProps<{
  /** In the order of the catalog. */
  items: readonly { slug: string; auto: boolean; missing: readonly string[] }[];
  properties: readonly SharedProperty[];
  values: Readonly<Record<string, PropertyValue | undefined>>;
  policy: ConflictPolicy;
  loading: boolean;
}>();
const emit = defineEmits<{
  remove: [slug: string];
  'update-value': [key: string, value: PropertyValue | undefined];
  'update-policy': [policy: ConflictPolicy];
  preview: [];
}>();

const POLICIES: readonly { value: ConflictPolicy; label: string }[] = [
  { value: 'fail', label: 'Stop at the first conflict' },
  { value: 'skip', label: 'Keep what already exists' },
  { value: 'overwrite', label: 'Replace what already exists' },
];

const typed = (event: Event, type: SharedProperty['type']): PropertyValue | undefined => {
  const input = event.target as HTMLInputElement;
  if (type === 'boolean') {
    return input.checked;
  }
  if (type === 'number') {
    return input.value === '' ? undefined : Number(input.value);
  }
  return input.value;
};
</script>

<template>
  <section class="basket" aria-label="Basket">
    <h2>Basket ({{ items.length }})</h2>
    <p v-if="items.length === 0" class="empty">
      Nothing in the basket. Choose modules in the tree: Space adds the module that has the focus.
    </p>
    <ul v-else class="items">
      <li v-for="item in items" :key="item.slug" class="item">
        <span class="name">{{ item.slug }}</span>
        <span v-if="item.auto" class="auto">Added automatically</span>
        <button
          type="button"
          class="remove"
          :aria-label="`Remove ${item.slug} from the basket`"
          @click="emit('remove', item.slug)"
        >
          Remove
        </button>
        <p v-if="item.missing.length > 0" class="missing">
          Needs {{ item.missing.join(', ') }}, which the project does not have and the basket does not bring.
        </p>
      </li>
    </ul>

    <fieldset v-if="properties.length > 0">
      <legend>Options</legend>
      <div v-for="property in properties" :key="property.key" class="field">
        <label :for="`option-${property.key}`">
          <code>{{ property.key }}</code>
          <strong v-if="property.mandatory" class="required">required</strong>
        </label>
        <input
          v-if="property.type === 'boolean'"
          :id="`option-${property.key}`"
          type="checkbox"
          :checked="values[property.key] === true"
          :aria-describedby="`option-${property.key}-help`"
          @change="emit('update-value', property.key, typed($event, property.type))"
        />
        <input
          v-else
          :id="`option-${property.key}`"
          :type="property.type === 'number' ? 'number' : 'text'"
          :value="values[property.key] ?? ''"
          :aria-describedby="`option-${property.key}-help`"
          @input="emit('update-value', property.key, typed($event, property.type))"
        />
        <span :id="`option-${property.key}-help`" class="help">
          {{ property.description }}. Used by {{ property.usedBy.join(', ') }}.
        </span>
      </div>
    </fieldset>

    <div class="policy">
      <label for="policy">What to do with conflicts</label>
      <select
        id="policy"
        :value="policy"
        @change="emit('update-policy', ($event.target as HTMLSelectElement).value as ConflictPolicy)"
      >
        <option v-for="option in POLICIES" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <button type="button" class="preview" :disabled="items.length === 0 || loading" @click="emit('preview')">
      {{ loading ? 'Previewing…' : 'Preview' }}
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 0.5rem;
}
.empty {
  color: var(--color-muted);
}
.items {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-border);
}
.name {
  font-family: var(--font-mono);
  font-weight: 600;
}
.auto {
  padding: 0 0.5rem;
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  font-size: 0.8125rem;
}
.remove {
  margin-left: auto;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}
.missing {
  flex-basis: 100%;
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
}
fieldset {
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.field {
  display: grid;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
}
.field input[type='text'],
.field input[type='number'],
select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: var(--radius);
  font: inherit;
}
.required {
  margin-left: 0.5rem;
  color: var(--color-primary-strong);
}
.help {
  color: var(--color-muted);
  font-size: 0.875rem;
}
.policy {
  display: grid;
  gap: 0.125rem;
  margin-bottom: 1rem;
}
.preview {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  cursor: pointer;
}
.preview:disabled {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: not-allowed;
}
</style>
