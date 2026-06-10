import { useMemo } from 'react';

/**
 * Format mm/yyyy with zero-padded month; returns the placeholder when either
 * piece is missing. The date range string returns the placeholder if BOTH
 * sides are missing, otherwise it shows whatever is available.
 */
function pad2(n) {
  if (typeof n !== 'number') return null;
  return String(n).padStart(2, '0');
}

function fmtMonthYear(month, year) {
  const m = pad2(month);
  if (!m || !year) return null;
  return `${m}/${year}`;
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
