import { useCallback } from 'react';

/**
 * threshold shape:
 *   null  (off)  or
 *   { operator: '>'|'<'|'between'|'==', value1: number, value2?: number }
 */
export const OPERATORS = [
  { value: '>',       label: 'גדול מ-' },
  { value: '<',       label: 'קטן מ-' },
  { value: '==',      label: 'שווה ל-' },
  { value: 'between', label: 'בין' },
];

export function useThresholdHighlightLogic({ threshold, onChange }) {
  const enabled = !!threshold;

  const setEnabled = useCallback((on) => {
    if (on) {
      onChange({
        operator: threshold?.operator ?? '>',
        value1:   threshold?.value1   ?? 0,
        value2:   threshold?.value2   ?? 0,
      });
    } else {
      onChange(null);
    }
  }, [threshold, onChange]);

  const update = useCallback((patch) => {
    onChange({ ...(threshold || { operator: '>', value1: 0 }), ...patch });
  }, [threshold, onChange]);

  return { enabled, setEnabled, update };
}
