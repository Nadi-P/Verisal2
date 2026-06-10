import { useCallback } from 'react';

/**
 * Per-field config is stored in the preset shape as:
 *   config.filters[field]       = array of allowed values (undefined = all pass)
 *   config.fxConversions[field] = { currency, direction: 'toIls'|'fromIls', month, year }
 *   config.thresholds[field]    = { operator: '>'|'<'|'between'|'==', value1, value2? }
 *   config.statHighlights[field]= { kind: 'top10'|'top10pct'|'bottom10'|'bottom10pct'|'aboveAvg'|'belowAvg' }
 *
 * The hook gives the screen narrow setters that update those slots.
 */
function clone(cfg) {
  return {
    rows:           [...cfg.rows],
    columns:        [...(cfg.columns || [])],
    values:         cfg.values.map((v) => ({ ...v })),
    filters:        { ...(cfg.filters || {}) },
    fxConversions:  { ...(cfg.fxConversions || {}) },
    thresholds:     { ...(cfg.thresholds || {}) },
    statHighlights: { ...(cfg.statHighlights || {}) },
  };
}

export function useFieldConfigScreenLogic({ field, config, onConfigChange }) {
  const filter        = (config.filters || {})[field];
  const fx            = (config.fxConversions || {})[field];
  const threshold     = (config.thresholds || {})[field];
  const statHighlight = (config.statHighlights || {})[field];

  const setFilter = useCallback((nextSelection) => {
    const next = clone(config);
    if (nextSelection === undefined) delete next.filters[field];
    else next.filters[field] = nextSelection;
    onConfigChange(next);
  }, [config, field, onConfigChange]);

  const setFx = useCallback((nextFx) => {
    const next = clone(config);
    if (nextFx === null) delete next.fxConversions[field];
    else next.fxConversions[field] = nextFx;
    onConfigChange(next);
  }, [config, field, onConfigChange]);

  const setThreshold = useCallback((nextThreshold) => {
    const next = clone(config);
    if (nextThreshold === null) delete next.thresholds[field];
    else next.thresholds[field] = nextThreshold;
    onConfigChange(next);
  }, [config, field, onConfigChange]);

  const setStatHighlight = useCallback((nextStat) => {
    const next = clone(config);
    if (nextStat === null) delete next.statHighlights[field];
    else next.statHighlights[field] = nextStat;
    onConfigChange(next);
  }, [config, field, onConfigChange]);

  return {
    filter, fx, threshold, statHighlight,
    setFilter, setFx, setThreshold, setStatHighlight,
  };
}
