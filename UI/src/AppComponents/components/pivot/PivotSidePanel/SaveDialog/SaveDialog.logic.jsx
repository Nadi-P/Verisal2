import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * SaveDialog has three modes:
 *   'choose'  — user picks Override vs Save-as-new
 *   'naming'  — user types a new name
 *   (confirmation for the override path is handled by the parent via
 *    a separate ConfirmDialog — this dialog just emits a request)
 */
export function useSaveDialogLogic({ existingNames, onCancel, onPickOverride, onSubmitNew }) {
  const [mode, setMode] = useState('choose');
  const [name, setName] = useState('');

  /* ---- Validation ---- */
  const trimmed = name.trim();
  const existingSet = useMemo(() => new Set(existingNames.map(n => n.trim())), [existingNames]);

  const nameError = useMemo(() => {
    if (mode !== 'naming') return null;
    if (trimmed === '') return null;                            // don't yell at empty input yet
    if (existingSet.has(trimmed)) return 'שם זה כבר בשימוש';
    return null;
  }, [mode, trimmed, existingSet]);

  const canSubmitNew = mode === 'naming' && trimmed !== '' && !nameError;

  /* ---- Escape closes ---- */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  /* ---- Actions ---- */
  const pickOverride = useCallback(() => onPickOverride?.(), [onPickOverride]);
  const pickNew      = useCallback(() => setMode('naming'), []);
  const backToChoose = useCallback(() => { setMode('choose'); setName(''); }, []);

  const submitNew = useCallback(() => {
    if (!canSubmitNew) return;
    onSubmitNew?.(trimmed);
  }, [canSubmitNew, trimmed, onSubmitNew]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onCancel?.();
  }, [onCancel]);

  return {
    mode,
    name, setName,
    nameError,
    canSubmitNew,
    pickOverride, pickNew, backToChoose, submitNew,
    handleOverlayClick,
  };
}
