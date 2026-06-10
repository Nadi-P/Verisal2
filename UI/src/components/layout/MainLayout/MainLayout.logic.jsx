import { useState, useCallback } from 'react';

/**
 * Top-level navigation state for the entire app shell.
 * Manages which page/report is currently active.
 */
export function useMainLayoutLogic() {
  const [activePage, setActivePage] = useState({ type: 'page', id: 'dashboard' });

  const handleNavigate = useCallback((target) => {
    // target: { type: 'page'|'report', id: string }
    setActivePage(target);
  }, []);

  return { activePage, handleNavigate };
}
