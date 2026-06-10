import { useMemo } from 'react';

/**
 * Processes KPI data for display.
 *
 * @param {Object} params
 * @param {number|string} params.value    - The main KPI value
 * @param {string}        [params.format] - 'number' | 'currency' | 'percent' | 'raw'
 * @param {number}        [params.change] - Change vs. previous period (positive = up)
 */
export function useKPICardLogic({
  value = 0,
  format = 'number',
  change,
}) {
  const formattedValue = useMemo(() => {
    if (format === 'raw' || typeof value === 'string') return String(value);
    const num = Number(value) || 0;
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('he-IL', {
          style: 'currency',
          currency: 'ILS',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      case 'percent':
        return `${num.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('he-IL', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
    }
  }, [value, format]);

  const changeInfo = useMemo(() => {
    if (change == null) return null;
    const num = Number(change);
    return {
      direction: num > 0 ? 'up' : num < 0 ? 'down' : 'neutral',
      label: `${num > 0 ? '+' : ''}${num.toFixed(1)}%`,
    };
  }, [change]);

  return { formattedValue, changeInfo };
}
