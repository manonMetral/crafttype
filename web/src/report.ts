import type { Decision, ReportInfo } from './types';

/** The words of `crafttype apply --dry-run`. */
export const DECISION_LABEL: Record<Decision, string> = {
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

/** What a module does or did, counted: "2 created, 1 modified." */
export const sentence = (report: ReportInfo): string => {
  const parts = COUNTS.filter(([key]) => report[key] > 0).map(([key, label]) => `${report[key]} ${label}`);
  return parts.length === 0 ? 'Nothing to change.' : `${parts.join(', ')}.`;
};
