import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

const SCREENS = {
  EDIT:         'edit',
  MANAGE:       'manage',
  FIELD_CONFIG: 'fieldConfig',
};

/**
 * Orchestrator hook for the pivot side panel.
 *
 * Now driven by the name-reference model:
 *   savedPresets — { name: configBlob }
 *   defaultName  — string | null (already resolved by ReportPage)
 *   appliedName  — string | null (already resolved by ReportPage)
 *
 * Override-current targets `appliedName` (which may resolve to `defaultName`
 * via the parent's fallback chain). If both are null, override is disabled.
 */
export function usePivotSidePanelLogic({
  isOpen,
  setIsOpen,
  defaultName,
  appliedName,
  savedPresets,
  config,
  onOverrideCurrent,
  onSaveNamed,
  onLoadPreset,
  onDeletePreset,
  onRenamePreset,
  onResetToDefault,
  onSetAsDefault,
  showToast,
}) {
  /* ---- Open / closed (lifted to parent so external buttons can toggle) ---- */
  const open  = useCallback(() => setIsOpen(true),  [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);

  // While closed: clicking inside the table area reopens the panel.
  useEffect(() => {
    if (isOpen) return;
    const handler = (e) => {
      const main = document.querySelector('.report-page-main');
      if (main && main.contains(e.target)) setIsOpen(true);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [isOpen, setIsOpen]);

  /* ---- Screen navigation + transition state ---- */
  const [screen, setScreen]                 = useState(SCREENS.EDIT);
  const [outgoingScreen, setOutgoingScreen] = useState(null);
  const [direction, setDirection]           = useState('forward');   // 'forward' | 'back'
  const TRANSITION_MS = 260;
  const transitionTimerRef = useRef(null);

  const beginTransition = useCallback((nextScreen, dir) => {
    if (nextScreen === screen) return;
    // If a previous transition is still in flight, finalize it immediately
    // so we don't stack outgoing layers.
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setOutgoingScreen(screen);
    setDirection(dir);
    setScreen(nextScreen);
    transitionTimerRef.current = setTimeout(() => {
      setOutgoingScreen(null);
      transitionTimerRef.current = null;
    }, TRANSITION_MS);
  }, [screen]);

  const goTo   = useCallback((next) => beginTransition(next, 'forward'), [beginTransition]);
  const goBack = useCallback(()     => beginTransition(SCREENS.EDIT, 'back'), [beginTransition]);

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  /* ---- Field config target ---- */
  const [editingField, setEditingField] = useState(null);   // { zone, index, field }

  const openFieldConfig = useCallback((zone, index, field) => {
    setEditingField({ zone, index, field });
    goTo(SCREENS.FIELD_CONFIG);
  }, [goTo]);

  /* ---- Dialog state ---- */
  const [dialog, setDialog] = useState(null);

  const dismissDialog = useCallback((silent = false) => {
    if (dialog && !silent) dialog.props?.onCancel?.();
    setDialog(null);
  }, [dialog]);

  /* ---- Computed ---- */
  // True if there's any current target for "Override current" to write to.
  const canOverride = Boolean(appliedName && savedPresets[appliedName]);

  // Has the live config diverged from the applied preset's saved version?
  // Live config carries BOTH pivot fields and a `table` slot — any divergence
  // in any branch counts as modified.
  const isModified = useMemo(() => {
    if (!appliedName || !savedPresets[appliedName]) {
      const t = config.table || {};
      return (
        config.rows.length || config.values.length ||
        Object.keys(config.filters || {}).length ||
        Object.keys(config.fxConversions || {}).length ||
        Object.keys(config.thresholds || {}).length ||
        Object.keys(config.statHighlights || {}).length ||
        (config.deviations || []).length ||
        (t.columnOrder || []).length ||
        (t.hidden      || []).length ||
        (t.pinned      || []).length ||
        !!t.sortBy
      );
    }
    return JSON.stringify(config) !== JSON.stringify(savedPresets[appliedName]);
  }, [config, appliedName, savedPresets]);

  /* ---- TopBar intercepts: dialog open → dismiss + cancel toast ---- */
  const intercept = useCallback((fn) => () => {
    if (dialog) {
      dismissDialog(false);
      showToast?.('הפעולה בוטלה', 'success');
      return;
    }
    fn();
  }, [dialog, dismissDialog, showToast]);

  /* ---- TopBar actions ---- */
  const handleReset = useCallback(() => {
    if (!isModified) return;
    setDialog({
      kind: 'confirm',
      props: {
        title:        'איפוס לברירת מחדל',
        message:      'התצורה הנוכחית תוחלף בברירת המחדל של הדוח. להמשיך?',
        confirmLabel: 'אפס',
        onConfirm: () => {
          onResetToDefault?.();
          showToast?.('אופס לברירת מחדל', 'success');
          setDialog(null);
        },
        onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
      },
    });
  }, [isModified, onResetToDefault, showToast]);

  const handleSave = useCallback(() => {
    setDialog({
      kind: 'save',
      props: {
        existingNames:    Object.keys(savedPresets),
        overrideDisabled: !canOverride,
        overrideTargetName: appliedName,   // for the dialog's confirmation copy
        onPickOverride: () => {
          if (!canOverride) return;
          setDialog({
            kind: 'confirm',
            props: {
              title:        'דרוס תבנית',
              message:      `התצורה הנוכחית תיכתב על "${appliedName}". להמשיך?`,
              confirmLabel: 'דרוס',
              variant:      'danger',
              onConfirm: async () => {
                await onOverrideCurrent?.();
                showToast?.(`"${appliedName}" עודכן`, 'success');
                setDialog(null);
              },
              onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
            },
          });
        },
        onSubmitNew: async (name) => {
          await onSaveNamed?.(name);
          showToast?.(`התבנית "${name}" נשמרה`, 'success');
          setDialog(null);
        },
      },
    });
  }, [savedPresets, canOverride, appliedName, onOverrideCurrent, onSaveNamed, showToast]);

  const handleManage = useCallback(() => goTo(SCREENS.MANAGE), [goTo]);

  /* ---- Manage screen actions ---- */
  const requestApply = useCallback((name) => {
    setDialog({
      kind: 'confirm',
      props: {
        title:        'החל תבנית',
        message:      `התצורה הנוכחית תוחלף בתבנית "${name}". להמשיך?`,
        confirmLabel: 'החל',
        onConfirm: () => {
          onLoadPreset?.(name);
          showToast?.(`התבנית "${name}" הוחלה`, 'success');
          setDialog(null);
          // Auto-navigate back to the edit screen so the user lands in the editor.
          beginTransition(SCREENS.EDIT, 'back');
        },
        onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
      },
    });
  }, [onLoadPreset, showToast, beginTransition]);

  const requestDelete = useCallback((name) => {
    if (name === defaultName) return;     // Should never happen (UI disabled), but guard anyway.
    setDialog({
      kind: 'confirm',
      props: {
        title:        'מחק תבנית',
        message:      `תבנית "${name}" תימחק לצמיתות. להמשיך?`,
        confirmLabel: 'מחק',
        variant:      'danger',
        onConfirm: async () => {
          await onDeletePreset?.(name);
          showToast?.(`התבנית "${name}" נמחקה`, 'success');
          setDialog(null);
        },
        onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
      },
    });
  }, [defaultName, onDeletePreset, showToast]);

  const requestRename = useCallback((oldName) => {
    setDialog({
      kind: 'rename',
      props: {
        originalName:  oldName,
        existingNames: Object.keys(savedPresets),
        onSubmit: async (newName) => {
          // Same-name → no-op, just close.
          if (newName === oldName) { setDialog(null); return; }
          await onRenamePreset?.(oldName, newName);
          setDialog(null);
        },
        onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
      },
    });
  }, [savedPresets, onRenamePreset, showToast]);

  const requestSetAsDefault = useCallback((name) => {
    setDialog({
      kind: 'confirm',
      props: {
        title:        'קבע כברירת מחדל',
        message:      `תבנית "${name}" תהפוך לתבנית ברירת המחדל של הדוח. להמשיך?`,
        confirmLabel: 'קבע',
        onConfirm: async () => {
          await onSetAsDefault?.(name);
          showToast?.(`התבנית "${name}" נקבעה כברירת מחדל`, 'success');
          setDialog(null);
        },
        onCancel: () => showToast?.('הפעולה בוטלה', 'success'),
      },
    });
  }, [onSetAsDefault, showToast]);

  /* ---- Escape closes dialog if any, else closes panel ---- */
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (dialog) dismissDialog(false);
      else if (isOpen) close();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [dialog, isOpen, dismissDialog, close]);

  return {
    // Open/closed
    isOpen, open, close,

    // Screens
    screen, outgoingScreen, direction, goBack,
    SCREENS,

    // Field config target
    editingField, openFieldConfig,

    // Dialog
    dialog, dismissDialog,

    // Computed
    isModified,
    canOverride,

    // TopBar actions (intercept dismisses dialog if any)
    handleReset:  intercept(handleReset),
    handleSave:   intercept(handleSave),
    handleManage: intercept(handleManage),
    handleClose:  intercept(close),

    // Manage screen actions
    requestApply,
    requestDelete,
    requestRename,
    requestSetAsDefault,
  };
}
