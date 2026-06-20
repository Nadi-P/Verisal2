/**
 * Operator catalog (threshold + statistical) for the merged highlight UI.
 *
 * Storage shape stays SPLIT between `config.thresholds[field]` (threshold
 * ops) and `config.statHighlights[field]` (stat ops) so the existing
 * PivotTable.logic + table-mode renderers keep working with no churn.
 * The merged UI just routes its writes to the correct slot.
 */
export const ALL_OPERATORS = [
  {
    label: 'תנאי על ערך',
    options: [
      { value: '>',       label: 'גדול מ-',    type: 'threshold', args: 1 },
      { value: '<',       label: 'קטן מ-',     type: 'threshold', args: 1 },
      { value: '>=',      label: 'גדול או שווה', type: 'threshold', args: 1 },
      { value: '<=',      label: 'קטן או שווה', type: 'threshold', args: 1 },
      { value: '==',      label: 'שווה ל-',    type: 'threshold', args: 1 },
      { value: 'between', label: 'בין',        type: 'threshold', args: 2 },
    ],
  },
  {
    label: 'תנאי סטטיסטי',
    options: [
      { value: 'top10',       label: '10 הגבוהים ביותר',    type: 'stat', args: 0 },
      { value: 'top10pct',    label: '10% הגבוהים ביותר',   type: 'stat', args: 0 },
      { value: 'bottom10',    label: '10 הנמוכים ביותר',    type: 'stat', args: 0 },
      { value: 'bottom10pct', label: '10% הנמוכים ביותר',   type: 'stat', args: 0 },
      { value: 'aboveAvg',    label: 'מעל הממוצע',          type: 'stat', args: 0 },
      { value: 'belowAvg',    label: 'מתחת לממוצע',         type: 'stat', args: 0 },
    ],
  },
];

const OP_BY_VALUE = (() => {
  const m = {};
  for (const g of ALL_OPERATORS) for (const o of g.options) m[o.value] = o;
  return m;
})();

export function opTypeAndArgs(opValue) {
  const o = OP_BY_VALUE[opValue];
  return o
    ? { type: o.type, args: o.args }
    : { type: 'threshold', args: 1 };
}

/**
 * Given the currently-stored threshold + stat configs for the field,
 * derive which operator the UI should show as "active". Prefers stat
 * when present (so a switch into stat-mode is sticky); falls back to
 * threshold; defaults to '>' when neither is set.
 */
export function deriveActiveOp(threshold, statHighlight) {
  if (statHighlight?.kind) return statHighlight.kind;
  if (threshold?.operator) return threshold.operator;
  return '>';
}

/**
 * Build the storage payload for a freshly-picked operator. For
 * threshold-style ops we reuse prior values when present; for stat-style
 * ops the payload is just `{ kind }`.
 */
export function buildPayload(opValue, prevThreshold, prevStat) {
  const { type } = opTypeAndArgs(opValue);
  if (type === 'stat') return { kind: opValue };
  return {
    operator: opValue,
    value1:   prevThreshold?.value1 ?? 0,
    value2:   prevThreshold?.value2 ?? 0,
  };
}
