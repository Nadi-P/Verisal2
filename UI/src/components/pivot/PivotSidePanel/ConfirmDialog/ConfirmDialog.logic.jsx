import { useEffect, useCallback } from 'react';

/**
 * Tiny hook: closes on Escape, calls onCancel.
 */
export function useConfirmDialogLogic({ onCancel }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Clicking the overlay (outside the dialog body) cancels.
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onCancel?.();
  }, [onCancel]);

  return { handleOverlayClick };
}
