import { useCallback, useMemo } from 'react';

/**
 * Synthetic field key used in config.values + config.thresholds + stat
 * highlight maps for the columns produced by a deviation pair.
 */
export function deviationFieldKey(id, kind) {
  return `__dev_${id}_${kind}`;
}

/**
 * Detect a value-list entry that came from a deviation pair.
 */
export function isDeviationValueItem(item) {
  return !!item && item.deviation === true;
}

/**
 * Pure helper — given current values + deviations, sync values so that
 * each (deviation, kind) with its checkbox on has exactly one matching
 * entry in values, and remove any deviation entries whose checkbox is off
 * or whose pair has been deleted.
 *
 * Preserves the order of existing items.
 */
export function syncValuesWithDeviations(values, deviations) {
  // Index of allowed deviation field keys → metadata for that entry.
  const allowed = new Map();
  for (const d of deviations) {
    if (d.showDiff) {
      allowed.set(deviationFieldKey(d.id, 'diff'), { id: d.id, kind: 'diff', name: d.name || '' });
    }
    if (d.showPercent) {
      allowed.set(deviationFieldKey(d.id, 'percent'), { id: d.id, kind: 'percent', name: d.name || '' });
    }
  }

  // Walk current values: keep regular ones as-is; for deviation entries,
  // keep iff still allowed and refresh the cached name.
  const out = [];
  const seen = new Set();
  for (const v of values) {
    if (isDeviationValueItem(v)) {
      if (allowed.has(v.field)) {
        const meta = allowed.get(v.field);
        out.push({ ...v, name: meta.name });
        seen.add(v.field);
      }
      // else: deviation no longer allowed → drop it
    } else {
      out.push(v);
    }
  }

  // Append any newly-allowed deviation entries that aren't already in the list.
  for (const [key, meta] of allowed.entries()) {
    if (!seen.has(key)) {
      out.push({
        field: key,
        deviation: true,
        kind: meta.kind,
        deviationId: meta.id,
        name: meta.name,
      });
    }
  }

  return out;
}

/**
 * Top-level hook for the DeviationColumns section.
 */
export function useDeviationColumnsLogic({ config, onConfigChange }) {
  /* ---- Source-field candidates: currently-used numeric Values fields ---- */
  const numericFields = useMemo(() => {
    return config.values
      .filter((v) => !isDeviationValueItem(v) && v.aggregation && v.aggregation !== 'first')
      .map((v) => v.field);
  }, [config.values]);

  /* ---- CRUD ---- */
  const writeBack = useCallback((nextDeviations) => {
    const nextValues = syncValuesWithDeviations(config.values, nextDeviations);
    onConfigChange({ ...config, deviations: nextDeviations, values: nextValues });
  }, [config, onConfigChange]);

  const addDeviation = useCallback(() => {
    const id = `dev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const next = [...(config.deviations || []), {
      id,
      sourceA:     null,
      sourceB:     null,
      name:        '',
      showDiff:    true,
      showPercent: false,
    }];
    writeBack(next);
  }, [config.deviations, writeBack]);

  const updateDeviation = useCallback((updated) => {
    const next = (config.deviations || []).map((d) => d.id === updated.id ? updated : d);
    writeBack(next);
  }, [config.deviations, writeBack]);

  const deleteDeviation = useCallback((id) => {
    const next = (config.deviations || []).filter((d) => d.id !== id);
    writeBack(next);
  }, [config.deviations, writeBack]);

  return { numericFields, addDeviation, updateDeviation, deleteDeviation };
}
