<script setup lang="ts">
import { DECISION_LABEL, sentence } from './report';
import type { BasketPreview } from './types';
import styles from './PreviewResult.module.css';

withDefaults(defineProps<{ preview: BasketPreview; applying?: boolean; label?: string }>(), {
  applying: false,
  label: 'Create the project',
});
defineEmits<{ apply: [] }>();

const OUTCOME_LABEL = { ready: 'Ready', conflict: 'Conflict', blocked: 'Blocked', 'not-run': 'Not run' } as const;
</script>

<template>
  <section :class="styles.result" aria-label="Preview">
    <h2>Preview</h2>
    <p id="preview-summary" role="status" :class="[styles.summary, preview.canApply && styles.ok]">
      {{
        preview.canApply ? 'Ready: every module would apply.' : 'The basket cannot apply yet: see the modules below.'
      }}
    </p>
    <ol>
      <li v-for="step in preview.steps" :key="step.slug" :class="styles.step" :data-outcome="step.outcome">
        <p :class="styles.head">
          <span :class="styles.slug">{{ step.slug }}</span>
          <span :class="styles.outcome">{{ OUTCOME_LABEL[step.outcome] }}</span>
        </p>

        <template v-if="step.outcome === 'ready' || step.outcome === 'conflict'">
          <p :class="styles.report">{{ sentence(step.report) }}</p>
          <p v-if="step.outcome === 'conflict'" :class="styles.hint">
            Keep or replace what already exists (the choice is under the basket), then preview again.
          </p>
          <p v-for="warning in step.warnings" :key="warning" :class="styles.warning">Warning: {{ warning }}</p>
          <details v-if="step.changes.length > 0" :open="step.outcome === 'conflict'">
            <summary>Changes ({{ step.changes.length }})</summary>
            <ul>
              <li
                v-for="change in step.changes"
                :key="`${change.kind}:${change.target}`"
                :class="styles.change"
                :data-decision="change.decision"
              >
                <span :class="styles.decision">{{ DECISION_LABEL[change.decision] }}</span>
                <span :class="styles.what">{{ change.description }}</span>
              </li>
            </ul>
          </details>
        </template>

        <template v-else-if="step.outcome === 'blocked'">
          <p :class="styles.error">{{ step.error }}</p>
          <p v-if="step.missing.length > 0" :class="styles.lacks">
            Needs {{ step.missing.join(', ') }}: add it to the basket.
          </p>
        </template>

        <p v-else-if="step.outcome === 'not-run'" :class="styles.after">
          Not run: the basket stops after {{ step.after }}.
        </p>
      </li>
    </ol>
    <button
      type="button"
      :class="styles.create"
      :disabled="applying || !preview.canApply"
      :aria-busy="applying"
      aria-describedby="preview-summary"
      @click="$emit('apply')"
    >
      {{ applying ? 'Creating…' : label }}
    </button>
  </section>
</template>
