<script setup lang="ts">
import { DECISION_LABEL, sentence } from './report';
import type { ApplyResult } from './types';
import styles from './AppliedResult.module.css';

defineProps<{ result: Extract<ApplyResult, { outcome: 'applied' }> }>();
</script>

<template>
  <section :class="styles.done" aria-label="Result">
    <h2>Done</h2>
    <p role="status" :class="styles.summary">
      {{ result.steps.length }} {{ result.steps.length === 1 ? 'module' : 'modules' }} applied in
      <code>{{ result.projectFolder }}</code
      >.
    </p>
    <ol>
      <li v-for="step in result.steps" :key="step.slug" :class="styles.step">
        <p :class="styles.head">
          <span :class="styles.slug">{{ step.slug }}</span>
        </p>
        <p :class="styles.report">{{ sentence(step.report) }}</p>
        <p v-for="warning in step.warnings" :key="warning" :class="styles.warning">Warning: {{ warning }}</p>
        <details v-if="step.changes.length > 0">
          <summary>Changes ({{ step.changes.length }})</summary>
          <ul>
            <li v-for="change in step.changes" :key="`${change.kind}:${change.target}`" :class="styles.change">
              <span :class="styles.decision">{{ DECISION_LABEL[change.decision] }}</span>
              <span :class="styles.what">{{ change.description }}</span>
            </li>
          </ul>
        </details>
      </li>
    </ol>
  </section>
</template>
