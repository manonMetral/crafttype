<script setup lang="ts">
import type { BasketPreview, Decision, ReportInfo } from './types';
import styles from './PreviewResult.module.css';

defineProps<{ preview: BasketPreview }>();

const OUTCOME_LABEL = { ready: 'Ready', conflict: 'Conflict', blocked: 'Blocked', 'not-run': 'Not run' } as const;

/** The words of `crafttype apply --dry-run`. */
const DECISION_LABEL: Record<Decision, string> = {
  create: 'create',
  edit: 'modify',
  unchanged: 'unchanged',
  keep: 'keep',
  overwrite: 'replace',
  skip: 'skip',
  conflict: 'conflict',
};

const COUNTS: readonly (readonly [keyof ReportInfo, string])[] = [
  ['created', 'created'],
  ['edited', 'modified'],
  ['replaced', 'replaced'],
  ['unchanged', 'unchanged'],
  ['kept', 'kept'],
  ['skipped', 'skipped'],
  ['conflicts', 'in conflict'],
];

const sentence = (report: ReportInfo): string => {
  const parts = COUNTS.filter(([key]) => report[key] > 0).map(([key, label]) => `${report[key]} ${label}`);
  return parts.length === 0 ? 'Nothing to change.' : `${parts.join(', ')}.`;
};
</script>

<template>
  <section :class="styles.result" aria-label="Preview">
    <h2>Preview</h2>
    <p role="status" :class="[styles.summary, preview.canApply && styles.ok]">
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
  </section>
</template>
