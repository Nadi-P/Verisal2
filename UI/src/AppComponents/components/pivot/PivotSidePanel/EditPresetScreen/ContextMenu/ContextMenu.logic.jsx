import { useEffect } from 'react';

/**
 * Auto-close: any click outside, scroll, or Escape dismisses the menu.
 */
export function useContextMenuLogic({ onClose }) {
  useEffect(() => {
    const close = () => onClose?.();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}
