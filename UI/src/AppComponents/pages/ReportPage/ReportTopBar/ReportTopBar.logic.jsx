import { useMemo } from 'react';

/**
 * Format M/YYYY using a single digit for the month when applicable
 * (per spec). Returns null when either piece is missing.
 */
function fmtMonthYear(month, year) {
  if (typeof month !== 'number' || typeof year !== 'number') return null;
  return `${month}/${year}`;
}

export function useReportTopBarLogic({ metadata }) {
  const dateRange = useMemo(() => {
    const from = fmtMonthYear(metadata?.min_month, metadata?.min_year);
    const to   = fmtMonthYear(metadata?.max_month, metadata?.max_year);
    if (!from && !to) return '— / —';
    return `${from || '—'} - ${to || '—'}`;
  }, [metadata]);

  const companyName = metadata?.company_name || '— / —';

  return { dateRange, companyName };
}
