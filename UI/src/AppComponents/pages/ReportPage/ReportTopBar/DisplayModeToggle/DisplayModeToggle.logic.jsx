import { useCallback } from 'react';

export const MODES = [
  { value: 'pivot', label: 'פיבוט' },
  { value: 'table', label: 'טבלה' },
];

/** Trivial wrapper; just normalizes the change handler. */
export function useDisplayModeToggleLogic({ value, onChange }) {
  const select = useCallback((v) => {
    if (v !== value) onChange?.(v);
  }, [value, onChange]);

  return { select };
}
