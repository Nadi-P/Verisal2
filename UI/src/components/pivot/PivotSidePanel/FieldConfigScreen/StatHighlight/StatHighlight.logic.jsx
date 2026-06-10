import { useCallback } from 'react';

/**
 * statHighlight shape:
 *   null  or
 *   { kind: 'top10' | 'top10pct' | 'bottom10' | 'bottom10pct' | 'aboveAvg' | 'belowAvg' }
 */
export const STAT_OPTIONS = [
  { value: 'top10',       label: '10 הגבוהים ביותר' },
  { value: 'top10pct',    label: '10% הגבוהים ביותר' },
  { value: 'bottom10',    label: '10 הנמוכים ביותר' },
  { value: 'bottom10pct', label: '10% הנמוכים ביותר' },
  { value: 'aboveAvg',    label: 'מעל הממוצע' },
  { value: 'belowAvg',    label: 'מתחת לממוצע' },
];

export function useStatHighlightLogic({ statHighlight, onChange }) {
  const enabled = !!statHighlight;

  const setEnabled = useCallback((on) => {
    if (on) onChange({ kind: statHighlight?.kind || 'top10' });
    else    onChange(null);
  }, [statHighlight, onChange]);

  const setKind = useCallback((kind) => onChange({ kind }), [onChange]);

  return { enabled, setEnabled, setKind };
}
