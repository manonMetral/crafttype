<script setup lang="ts">
import type { SharedProperty } from './basket';
import type { ConflictPolicy, PropertyValue } from './types';
import styles from './BasketPanel.module.css';

defineProps<{
  /** In the order of the catalog. */
  items: readonly { slug: string; auto: boolean; missing: readonly string[] }[];
  properties: readonly SharedProperty[];
  values: Readonly<Record<string, PropertyValue | undefined>>;
  policy: ConflictPolicy;
  loading: boolean;
  /** The basket is being written: it must not be previewed again meanwhile. */
  busy: boolean;
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
  <section :class="styles.basket" aria-label="Basket">
    <h2>Basket ({{ items.length }})</h2>
    <p v-if="items.length === 0" :class="styles.empty">
      Nothing in the basket. Choose modules in the tree: Space adds the module that has the focus.
    </p>
    <ul v-else :class="styles.items">
      <li v-for="item in items" :key="item.slug" :class="styles.item">
        <span :class="styles.name">{{ item.slug }}</span>
        <span v-if="item.auto" :class="styles.auto">Added automatically</span>
        <button
          type="button"
          :class="styles.remove"
          :aria-label="`Remove ${item.slug} from the basket`"
          @click="emit('remove', item.slug)"
        >
          Remove
        </button>
        <p v-if="item.missing.length > 0" :class="styles.missing">
          Needs {{ item.missing.join(', ') }}, which the project does not have and the basket does not bring.
        </p>
      </li>
    </ul>

    <fieldset v-if="properties.length > 0">
      <legend>Options</legend>
      <div v-for="property in properties" :key="property.key" :class="styles.field">
        <label :for="`option-${property.key}`">
          <code>{{ property.key }}</code>
          <strong v-if="property.mandatory" :class="styles.required">required</strong>
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
        <span :id="`option-${property.key}-help`" :class="styles.help">
          {{ property.description }}. Used by {{ property.usedBy.join(', ') }}.
        </span>
      </div>
    </fieldset>

    <div :class="styles.policy">
      <label for="policy">What to do with conflicts</label>
      <select
        id="policy"
        :value="policy"
        @change="emit('update-policy', ($event.target as HTMLSelectElement).value as ConflictPolicy)"
      >
        <option v-for="option in POLICIES" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <button
      type="button"
      :class="styles.preview"
      :disabled="items.length === 0 || loading || busy"
      @click="emit('preview')"
    >
      {{ loading ? 'Previewing…' : 'Preview' }}
    </button>
  </section>
</template>
