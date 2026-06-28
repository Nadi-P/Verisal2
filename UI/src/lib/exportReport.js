/**
 * Excel export for reports.
 *
 *   - "custom"   → the TABLE-view representation: visible columns only, in
 *                  display order (pinned first), with filters, sorting,
 *                  deviation columns and FX conversions applied — i.e. a
 *                  faithful copy of what the table shows. Mirrors the
 *                  pipeline in components/table/TableView.jsx exactly.
 *   - "original" → the manufactured report as produced (every column + row,
 *                  original order) with FX conversions applied.
 *
 * Saving: in Electron we get a path via the Save-As dialog and write the
 * workbook bytes through the preload bridge. A plain-browser fallback
 * triggers a normal download (dev convenience).
 */
import * as XLSX from 'xlsx';

const DEV_FIELD_PREFIX = '__dev_';

/* ---- FX + deviation helpers (mirror TableView.jsx) ------------------- */
function applyFx(rawValue, fx, fxRates) {
  if (rawValue === null || rawValue === undefined || rawValue === '' || !fx || !fxRates) return rawValue;
  const n = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', ''));
  if (isNaN(n)) return rawValue;
  const monthly = fxRates?.[fx.currency]?.[fx.year]?.[fx.month];
  if (!monthly || typeof monthly !== 'number') return rawValue;
  return fx.direction === 'toIls' ? n * monthly : n / monthly;
}

function expandDeviations(deviations) {
  const out = [];
  for (const d of deviations || []) {
    if (!d || !d.id) continue;
    if (d.showDiff)    out.push({ ...d, kind: 'diff',    fieldId: `${DEV_FIELD_PREFIX}${d.id}_diff` });
    if (d.showPercent) out.push({ ...d, kind: 'percent', fieldId: `${DEV_FIELD_PREFIX}${d.id}_percent` });
  }
  return out;
}

function rowDeviationValue(row, dev, kind, fxConversions, fxRates) {
  if (!dev || !dev.sourceA || !dev.sourceB) return null;
  const a = applyFx(row[dev.sourceA], fxConversions[dev.sourceA] || null, fxRates);
  const b = applyFx(row[dev.sourceB], fxConversions[dev.sourceB] || null, fxRates);
  const an = typeof a === 'number' ? a : parseFloat(String(a).replace(',', ''));
  const bn = typeof b === 'number' ? b : parseFloat(String(b).replace(',', ''));
  if (isNaN(an) || isNaN(bn)) return null;
  if (kind === 'percent') return an === 0 ? 0 : ((an - bn) / an) * 100;
  return an - bn;
}

/* ---- Custom: replicate the on-screen table ----------------------------- */
function buildCustom(columns, data, config, fxRates) {
  const cfg     = config || {};
  const table   = cfg.table || { columnOrder: [], hidden: [], pinned: [], sortBy: null };
  const filters = cfg.filters || {};
  const fxMap   = cfg.fxConversions || {};
  const rates   = fxRates || {};

  const expanded   = expandDeviations(cfg.deviations);
  const devFieldIds = expanded.map((d) => d.fieldId);
  const labelMap = new Map();
  for (const dev of expanded) {
    labelMap.set(dev.fieldId, dev.kind === 'percent' ? `${dev.name || ''} %`.trim() : (dev.name || '—'));
  }

  // Enrich rows with deviation values.
  let rows = (data || []).map((row) => {
    const next = { ...row };
    for (const dev of expanded) {
      next[dev.fieldId] = rowDeviationValue(row, dev, dev.kind, fxMap, rates);
    }
    return next;
  });

  // Column universe → reconcile persisted order → drop hidden → pinned first.
  const allFieldIds = [...columns, ...devFieldIds];
  const universe = new Set(allFieldIds);
  const persisted = (table.columnOrder || []).filter((c) => universe.has(c));
  const persistedSet = new Set(persisted);
  const orderedAll = [...persisted, ...allFieldIds.filter((c) => !persistedSet.has(c))];
  const hiddenSet = new Set(table.hidden || []);
  const pinnedSet = new Set(table.pinned || []);
  const visible = orderedAll.filter((c) => !hiddenSet.has(c));
  const pinnedInOrder   = visible.filter((c) => pinnedSet.has(c));
  const unpinnedInOrder = visible.filter((c) => !pinnedSet.has(c));
  const displayCols = [...pinnedInOrder, ...unpinnedInOrder];

  // Filters (allowed-values semantics).
  const filterEntries = Object.entries(filters);
  if (filterEntries.length > 0) {
    rows = rows.filter((row) => {
      for (const [colId, allowed] of filterEntries) {
        if (!allowed || !Array.isArray(allowed)) continue;
        if (allowed.length === 0) return false;
        if (!new Set(allowed.map(String)).has(String(row[colId] ?? ''))) return false;
      }
      return true;
    });
  }

  // Sort.
  if (table.sortBy && table.sortBy.columnId) {
    const { columnId, direction } = table.sortBy;
    const factor = direction === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = a[columnId]; const bv = b[columnId];
      const an = parseFloat(av); const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        return (an - bn) * factor;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'he') * factor;
    });
  }

  // FX conversion on raw columns that have it configured (deviation columns
  // already had FX applied during their computation).
  if (Object.keys(fxMap).length > 0) {
    rows = rows.map((row) => {
      const next = { ...row };
      for (const [colId, fx] of Object.entries(fxMap)) {
        if (colId in next) next[colId] = applyFx(next[colId], fx, rates);
      }
      return next;
    });
  }

  const headers = displayCols.map((c) => labelMap.get(c) || c);
  const body = rows.map((row) => displayCols.map((c) => normalizeCell(row[c])));
  return { headers, rows: body };
}

/* ---- Original: manufactured frame + FX --------------------------------- */
function buildOriginal(columns, data, config, fxRates) {
  const fxMap = (config && config.fxConversions) || {};
  const rates = fxRates || {};
  const headers = [...columns];
  const body = (data || []).map((row) =>
    columns.map((c) => {
      const fx = fxMap[c];
      return normalizeCell(fx ? applyFx(row[c], fx, rates) : row[c]);
    })
  );
  return { headers, rows: body };
}

/* Cells: keep numbers numeric so Excel treats them as numbers; pass strings
   through; null/undefined → empty string. */
function normalizeCell(v) {
  if (v === null || v === undefined) return '';
  return v;
}

/* ---- Workbook + save --------------------------------------------------- */
function sanitizeSheetName(name) {
  return (String(name || 'Report').replace(/[[\]:*?/\\]/g, ' ').trim() || 'Report').slice(0, 31);
}

function buildWorkbook(headers, rows, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!views'] = [{ RTL: true }];   // Hebrew reports read right-to-left
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  return wb;
}

async function saveWorkbook(wb, defaultName) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  if (api && api.saveFile && api.writeFileBytes) {
    const path = await api.saveFile(defaultName);
    if (!path) return false;                 // user canceled the Save-As dialog
    await api.writeFileBytes(path, buf);
    return true;
  }

  // Browser fallback (dev outside Electron): normal download.
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Build + save the report workbook.
 * @returns {Promise<boolean>} true if saved, false if the Save-As was canceled.
 */
export async function exportReport({ format, columns, data, config, fxRates, displayName }) {
  const built = format === 'original'
    ? buildOriginal(columns || [], data || [], config, fxRates)
    : buildCustom(columns || [], data || [], config, fxRates);
  const wb = buildWorkbook(built.headers, built.rows, displayName);
  return saveWorkbook(wb, `${displayName || 'report'}.xlsx`);
}
