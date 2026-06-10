import { useCallback } from 'react';

/**
 * FX shape:
 *   { currency: 'USD', direction: 'toIls' | 'fromIls', month: 1..12, year: 2026 }
 *
 * Reads the rate from the global fx_conversions.json structure:
 *   { currency: { year: { month: rate } } }
 */
export function useFxConverterLogic({ fx, onChange }) {
  const enabled = !!fx;

  const setEnabled = useCallback((on) => {
    if (on) {
      onChange({
        currency:  fx?.currency  || '',
        direction: fx?.direction || 'toIls',
        month:     fx?.month     || new Date().getMonth() + 1,
        year:      fx?.year      || new Date().getFullYear(),
      });
    } else {
      onChange(null);
    }
  }, [fx, onChange]);

  const update = useCallback((patch) => {
    onChange({ ...(fx || {}), ...patch });
  }, [fx, onChange]);

  return { enabled, setEnabled, update };
}
