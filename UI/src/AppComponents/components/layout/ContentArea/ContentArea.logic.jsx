import { useMemo } from 'react';

/**
 * Resolves which page component to render based on activePage.
 */
export function useContentAreaLogic({ activePage }) {
  const pageType = useMemo(() => {
    if (!activePage) return 'dashboard';
    return activePage.type === 'report' ? 'report' : activePage.id;
  }, [activePage]);

  const reportId = activePage?.type === 'report' ? activePage.id : null;

  return { pageType, reportId };
}
