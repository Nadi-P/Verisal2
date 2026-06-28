import { useState, useCallback, useEffect } from 'react';
import { useTrace } from '../../../contexts/TraceContext.jsx';

/**
 * Top-level navigation state for the entire app shell.
 * Manages which page/report is currently active.
 *
 * Also bridges TraceContext.navigateRequest into the navigation system:
 * when a ref-click in the trace UI targets a DIFFERENT report, the trace
 * layer pushes a navigateRequest; this hook consumes it and routes to
 * that report (preserving the rest of activePage).
 */
export function useMainLayoutLogic() {
  const [activePage, setActivePage] = useState({ type: 'page', id: 'dashboard' });

  const handleNavigate = useCallback((target) => {
    // target: { type: 'page'|'report', id: string }
    setActivePage(target);
  }, []);

  const { navigateRequest, consumeNavigateRequest } = useTrace();
  useEffect(() => {
    if (!navigateRequest) return;
    setActivePage({ type: 'report', id: navigateRequest.reportId });
    consumeNavigateRequest();
  }, [navigateRequest, consumeNavigateRequest]);

  return { activePage, handleNavigate };
}
