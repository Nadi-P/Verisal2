import { useState, useMemo, useCallback } from 'react';

/* ===================================================================
   Pure helpers
   =================================================================== */
function buildRowTree(data, rowDims, depth) {
  if (depth >= rowDims.length) {
    return { __leaf: true, rows: data };
  }
  const groups = new Map();
  const dim = rowDims[depth];
  for (const row of data) {
    const key = row[dim];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map(([key, rows]) => ({
      key,
      level: depth,
      rows,
      children: buildRowTree(rows, rowDims, depth + 1),
    }));
}

export function aggregate(rows, field, kind, fxConfig = null, fxRates = null) {
  if (rows.length === 0) return null;
  const vals = rows.map((r) => r[field]);

  if (kind === 'count') return vals.length;
  if (kind === 'first') return vals[0];

  const nums = vals
    .map((v) => (typeof v === 'string' ? parseFloat(v.replace(',', '')) : v))
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (nums.length === 0) return null;

  let result;
  switch (kind) {
    case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
    case 'avg': result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
    case 'min': result = Math.min(...nums); break;
    case 'max': result = Math.max(...nums); break;
    default:    result = nums.reduce((a, b) => a + b, 0);
  }

  // Apply FX conversion if configured for this field
  if (fxConfig && fxRates && typeof result === 'number') {
    const rate = fxRates?.[fxConfig.currency]?.[String(fxConfig.year)]?.[String(fxConfig.month)];
    if (typeof rate === 'number' && rate > 0) {
      if (fxConfig.direction === 'toIls')        result = result * rate;
      else if (fxConfig.direction === 'fromIls') result = result / rate;
    }
  }

  return result;
}

/* ===================================================================
   Highlight helpers
   =================================================================== */

/** Returns true (pass), false (fail), or null (no highlight). */
export function checkThreshold(value, config) {
  if (typeof value !== 'number' || !config) return null;
  switch (config.operator) {
    case '>':       return value >  config.value1;
    case '<':       return value <  config.value1;
    case '>=':      return value >= config.value1;
    case '<=':      return value <= config.value1;
    case '==':      return value === config.value1;
    case 'between': return value >= config.value1 && value <= config.value2;
    default:        return null;
  }
}

/** Pure stat-qualifying computer for callers outside the pivot path. */
export function computeStatQualifyingSet(cells, kind) {
  return computeStatQualifying(cells, kind);
}

/** Given a list of {path, value} numerics, return the set qualifying for `kind`. */
function computeStatQualifying(cells, kind) {
  if (cells.length === 0) return new Set();
  const sorted = [...cells].sort((a, b) => b.value - a.value);
  let take;
  switch (kind) {
    case 'top10':       take = sorted.slice(0, 10); break;
    case 'top10pct':    take = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1))); break;
    case 'bottom10':    take = sorted.slice(-10); break;
    case 'bottom10pct': take = sorted.slice(-Math.max(1, Math.ceil(sorted.length * 0.1))); break;
    case 'aboveAvg': {
      const avg = cells.reduce((s, c) => s + c.value, 0) / cells.length;
      take = cells.filter((c) => c.value > avg);
      break;
    }
    case 'belowAvg': {
      const avg = cells.reduce((s, c) => s + c.value, 0) / cells.length;
      take = cells.filter((c) => c.value < avg);
      break;
    }
    default: take = [];
  }
  return new Set(take.map((c) => c.path));
}

export function formatValue(v, opts = {}) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const str = Number.isInteger(v)
      ? v.toLocaleString('he-IL')
      : v.toLocaleString('he-IL', { maximumFractionDigits: 2 });
    return opts.suffix ? `${str}${opts.suffix}` : str;
  }
  return String(v);
}

/* ===================================================================
   Deviation columns
   =================================================================== */

/**
 * Computes a deviation cell value:
 *   diff    → aggregate(rows, A) − aggregate(rows, B)
 *   percent → ((A − B) / A) × 100   (returns 0 when A is 0)
 *
 * The aggregations for A and B come from their own entries in
 * `regularValues`. FX conversions apply per source field.
 *
 * Returns a number or null (null when either source isn't selected /
 * isn't found in the data).
 */
export function computeDeviation(rows, item, deviations, regularValues, fxConversions, fxRates) {
  if (!item || !item.deviationId) return null;
  const pair = deviations.find((d) => d.id === item.deviationId);
  if (!pair || !pair.sourceA || !pair.sourceB) return null;

  const aggA = (regularValues.find((v) => v.field === pair.sourceA) || {}).aggregation || 'sum';
  const aggB = (regularValues.find((v) => v.field === pair.sourceB) || {}).aggregation || 'sum';
  const fxA  = fxConversions[pair.sourceA] || null;
  const fxB  = fxConversions[pair.sourceB] || null;

  const valA = aggregate(rows, pair.sourceA, aggA, fxA, fxRates);
  const valB = aggregate(rows, pair.sourceB, aggB, fxB, fxRates);

  if (typeof valA !== 'number' || typeof valB !== 'number') return null;

  if (item.kind === 'diff')    return valA - valB;
  if (item.kind === 'percent') return valA === 0 ? 0 : ((valA - valB) / valA) * 100;
  return null;
}

/** Pick the right computation for a value entry (regular vs. deviation). */
export function computeValueCell(rows, item, deviations, regularValues, fxConversions, fxRates) {
  if (item && item.deviation) {
    return computeDeviation(rows, item, deviations, regularValues, fxConversions, fxRates);
  }
  const fx = fxConversions[item.field] || null;
  return aggregate(rows, item.field, item.aggregation, fx, fxRates);
}

/* ===================================================================
   Hook
   =================================================================== */
export function usePivotTableLogic({ data, config, fxRates, onExpandedChange }) {
  const { rows, columns: colDims, values, filters } = config;
  const fxConversions  = config.fxConversions  || {};
  const thresholds     = config.thresholds     || {};
  const statHighlights = config.statHighlights || {};
  const deviations     = config.deviations     || [];
  // Regular value entries only — used as the lookup for source-field
  // aggregations when computing deviation cells.
  const regularValues  = values.filter((v) => !v.deviation);

  // ---- Apply filters to raw data ----
  const filteredData = useMemo(() => {
    if (!data) return [];
    const filterEntries = Object.entries(filters || {});
    if (filterEntries.length === 0) return data;
    return data.filter((row) =>
      filterEntries.every(([field, allowed]) =>
        allowed.length === 0 ? false : allowed.includes(row[field])
      )
    );
  }, [data, filters]);

  // ---- Build column hierarchy (unique paths through column dims) ----
  const columnPaths = useMemo(() => {
    if (colDims.length === 0) return [[]];
    const seen = new Map();
    for (const row of filteredData) {
      const path = colDims.map((d) => row[d]);
      const key = path.join('');
      if (!seen.has(key)) seen.set(key, path);
    }
    return Array.from(seen.values()).sort((a, b) => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return String(a[i]).localeCompare(String(b[i]));
      }
      return 0;
    });
  }, [filteredData, colDims]);

  // ---- Build row tree ----
  const rowTree = useMemo(
    () => buildRowTree(filteredData, rows, 0),
    [filteredData, rows]
  );

  // ---- Expand / collapse state ----
  // The set of expanded paths is CONTROLLED by the report config (persisted
  // as a draft, so it survives leaving + returning — parity with table
  // mode). The transient `closing` set (exit animation) stays local.
  const expanded = useMemo(
    () => new Set(Array.isArray(config.expanded) ? config.expanded : []),
    [config.expanded]
  );
  const [closing, setClosing] = useState(() => new Set());
  const CLOSE_MS = 300;     // must match the CSS shrink animation duration

  const toggle = useCallback((path) => {
    const persist = (fn) => {
      if (onExpandedChange) onExpandedChange(fn);
    };
    if (!expanded.has(path)) {
      // Open: add to the persisted set; children fade in via CSS.
      persist((arr) => (arr.includes(path) ? arr : [...arr, path]));
      return;
    }
    // Close: mark as closing, let the animation play, then remove the path
    // from the persisted set and clear the closing marker.
    setClosing((c) => {
      const n = new Set(c);
      n.add(path);
      return n;
    });
    setTimeout(() => {
      persist((arr) => arr.filter((p) => p !== path));
      setClosing((c) => {
        const n = new Set(c);
        n.delete(path);
        return n;
      });
    }, CLOSE_MS);
  }, [expanded, onExpandedChange]);

  const totalValueCols = values.length * Math.max(columnPaths.length, 1);
  const isEmpty = rows.length === 0 && values.length === 0;
  // With the compact single-column layout, the row label always takes exactly one column.
  const labelColSpan = rows.length > 0 ? 1 : 0;

  // ---- Max possible label width (across ALL data, not just visible rows) ----
  const maxRowLabelLength = useMemo(() => {
    let max = 0;
    for (const dim of rows) {
      for (const row of filteredData) {
        const v = String(row[dim] ?? '');
        if (v.length > max) max = v.length;
      }
    }
    return max;
  }, [filteredData, rows]);

  // ---- Pre-compute stat-highlight qualifying sets per value column.
  // Done only on LEAF rows (deepest level); group rows aren't ranked. ----
  const statQualifyingPerValue = useMemo(() => {
    if (!Object.keys(statHighlights).length) return {};
    const perValue = {};   // valueIndex -> [{path, value}, ...]

    function walk(tree, parentPath) {
      if (!Array.isArray(tree)) return;
      for (const node of tree) {
        const path = parentPath + '' + node.key;
        const childrenIsArray = Array.isArray(node.children);
        if (childrenIsArray && node.children.length > 0) {
          walk(node.children, path);
        } else {
          values.forEach((vDef, vi) => {
            const val = computeValueCell(
              node.rows, vDef, deviations, regularValues, fxConversions, fxRates,
            );
            if (typeof val === 'number') {
              (perValue[vi] = perValue[vi] || []).push({ path, value: val });
            }
          });
        }
      }
    }
    walk(rowTree, '');

    const result = {};
    values.forEach((vDef, vi) => {
      const sh = statHighlights[vDef.field];
      if (!sh) return;
      result[vi] = computeStatQualifying(perValue[vi] || [], sh.kind);
    });
    return result;
  }, [rowTree, values, statHighlights, fxConversions, fxRates, deviations, regularValues]);

  return {
    rows,
    colDims,
    values,
    filteredData,
    columnPaths,
    rowTree,
    expanded,
    closing,
    toggle,
    totalValueCols,
    labelColSpan,
    isEmpty,
    maxRowLabelLength,
    fxConversions,
    thresholds,
    statQualifyingPerValue,
    fxRates,
    deviations,
    regularValues,
  };
}
