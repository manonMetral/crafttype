<script setup lang="ts">
import type { BasketPreview, Decision, ReportInfo } from './types';

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
  <section class="result" aria-label="Preview">
    <h2>Preview</h2>
    <p role="status" class="summary" :class="{ ok: preview.canApply }">
      {{
        preview.canApply ? 'Ready: every module would apply.' : 'The basket cannot apply yet: see the modules below.'
      }}
    </p>
    <ol>
      <li v-for="step in preview.steps" :key="step.slug" class="step" :data-outcome="step.outcome">
        <p class="head">
          <span class="slug">{{ step.slug }}</span>
          <span class="outcome">{{ OUTCOME_LABEL[step.outcome] }}</span>
        </p>

        <template v-if="step.outcome === 'ready' || step.outcome === 'conflict'">
          <p class="report">{{ sentence(step.report) }}</p>
          <p v-if="step.outcome === 'conflict'" class="hint">
            Keep or replace what already exists (the choice is under the basket), then preview again.
          </p>
          <p v-for="warning in step.warnings" :key="warning" class="warning">Warning: {{ warning }}</p>
          <details v-if="step.changes.length > 0" :open="step.outcome === 'conflict'">
            <summary>Changes ({{ step.changes.length }})</summary>
            <ul>
              <li
                v-for="change in step.changes"
                :key="`${change.kind}:${change.target}`"
                class="change"
                :data-decision="change.decision"
              >
                <span class="decision">{{ DECISION_LABEL[change.decision] }}</span>
                <span class="what">{{ change.description }}</span>
              </li>
            </ul>
          </details>
        </template>

        <template v-else-if="step.outcome === 'blocked'">
          <p class="error">{{ step.error }}</p>
          <p v-if="step.missing.length > 0" class="lacks">Needs {{ step.missing.join(', ') }}: add it to the basket.</p>
        </template>

        <p v-else-if="step.outcome === 'not-run'" class="after">Not run: the basket stops after {{ step.after }}.</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 0.5rem;
}
.summary {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  color: var(--color-danger);
}
.summary.ok {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: var(--radius);
}
.step[data-outcome='ready'] {
  border-left-color: var(--color-primary);
}
.step[data-outcome='conflict'],
.step[data-outcome='blocked'] {
  border-left-color: var(--color-danger);
}
.head,
.report,
.hint,
.warning,
.error,
.lacks,
.after {
  margin: 0 0 0.25rem;
}
.slug {
  font-family: var(--font-mono);
  font-weight: 600;
}
.outcome {
  margin-left: 0.5rem;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: 0.8125rem;
}
.hint,
.after {
  color: var(--color-muted);
}
.warning,
.error {
  color: var(--color-danger);
}
ul {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
  list-style: none;
}
.decision {
  display: inline-block;
  min-width: 5.5rem;
  font-family: var(--font-mono);
  color: var(--color-muted);
}
.change[data-decision='conflict'] .decision {
  color: var(--color-danger);
  font-weight: 600;
}
.what {
  font-family: var(--font-mono);
}
</style>
