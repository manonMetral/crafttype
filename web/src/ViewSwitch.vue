<script setup lang="ts">
import type { View } from './types';
import styles from './ViewSwitch.module.css';

defineProps<{ view: View }>();
defineEmits<{ 'update:view': [view: View] }>();

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'groups', label: 'By category' },
  { value: 'prerequisites', label: 'By prerequisites' },
];
</script>

<template>
  <div :class="styles.switch" role="group" aria-label="View of the modules">
    <button
      v-for="option in VIEWS"
      :key="option.value"
      type="button"
      :class="styles.option"
      :aria-pressed="view === option.value"
      @click="$emit('update:view', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
