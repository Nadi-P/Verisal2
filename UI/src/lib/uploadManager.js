/**
 * Hydration layer for the UploadManager wire payload.
 *
 * Backend ships:
 *   {
 *     registry: { [report_idx]: { id, display_label, is_input } },
 *     metadata: { company_name, min_month, min_year, max_month, max_year },
 *     unrecognized: [...],
 *     duplicates:   [...],
 *     reports: {
 *       [report_id]: {
 *         id, display_label, is_input, dependencies,
 *         company_name, min_month, ..., max_year,
 *         rows_count, columns_count,
 *         exceptions, status, missing_dependencies, skipped_steps,
 *         lineageFrame: {
 *           columns: [{ name, formula?, cells: [{ value, references? }, ...] }],
 *           rows_count
 *         } | null
 *       }
 *     }
 *   }
 *
 * The helpers below provide client-friendly access without forcing every
 * component to walk the column-major structure manually.
 */

/**
 * Format a (year, month) pair as M/YYYY (single-digit month when applicable).
 * Returns '' when either part is null/undefined.
 */
export function formatMonthYear(year, month) {
  if (year == null || month == null) return '';
  return `${month}/${year}`;
}

/**
 * Build a row-major `data: Array<Record<colName, value>>` view of a
 * lineageFrame's column-major cells. Used by AuditTable + PivotTable
 * which today consume that shape.
 *
 * Returns { columns, data, refsByCoord } where:
 *   columns        — string[]: column names in original order
 *   data           — Array<Record<string, any>>: one row per dataset row
 *   refsByCoord    — Map<`colIdx,rowIdx`, references[]>: O(1) lookup for
 *                    the Phase 3 trace UI. Empty for cells with no refs.
 */
export function lineageFrameToRowMajor(frame) {
  if (!frame || !frame.columns) {
    return { columns: [], data: [], refsByCoord: new Map(), formulas: {} };
  }
  const columns = frame.columns.map((c) => c.name);
  const rowsCount = frame.rows_count || 0;
  const data = new Array(rowsCount);
  const refsByCoord = new Map();
  const formulas = {};

  // Every row gets an `__origRow` tag with its canonical index. This
  // survives downstream sort/filter/group transformations so trace-target
  // resolution always lands on the right (colIdx, rowIdx) in the wire
  // payload — independent of how the table or pivot reshapes it.
  for (let r = 0; r < rowsCount; r++) data[r] = { __origRow: r };

  for (let c = 0; c < frame.columns.length; c++) {
    const col = frame.columns[c];
    if (col.formula) formulas[col.name] = col.formula;
    const cells = col.cells || [];
    for (let r = 0; r < cells.length; r++) {
      const cell = cells[r];
      data[r][col.name] = cell.value;
      if (cell.references && cell.references.length > 0) {
        refsByCoord.set(`${c},${r}`, cell.references);
      }
    }
  }

  return { columns, data, refsByCoord, formulas };
}

/**
 * Resolve a CellReference's report_idx to its registry entry.
 * Returns { id, display_label, is_input } or null on miss.
 */
export function resolveReportFromRef(payload, ref) {
  if (!payload || !payload.registry || ref == null) return null;
  const entry = payload.registry[String(ref.r)];
  return entry || null;
}

/**
 * Per-report accessor — returns the report block (metadata + frame) or null.
 */
export function getReport(payload, reportId) {
  if (!payload || !payload.reports) return null;
  return payload.reports[reportId] || null;
}

/**
 * All reports, bucketed by is_input — used by the sidebar.
 * Each bucket is sorted in the conventional sidebar order; reports not in
 * the convention are appended.
 */
const SYSTEM_ORDER = [
  'center', 'costing', 'income', 'absences',
  'deductions', 'providents', 'components',
];
const MANUFACTURED_ORDER = [
  'social_analysis', 'months_comparison', 'reports_against_center',
];

function _sortByConvention(reports, convention) {
  const map = new Map(reports.map((r) => [r.id, r]));
  const ordered = [];
  for (const id of convention) {
    if (map.has(id)) {
      ordered.push(map.get(id));
      map.delete(id);
    }
  }
  // Append any not in convention (defensive — new reports we haven't ordered yet).
  for (const r of map.values()) ordered.push(r);
  return ordered;
}

export function bucketReports(payload) {
  if (!payload || !payload.reports) return { system: [], manufactured: [] };
  const all = Object.values(payload.reports);
  const system       = all.filter((r) => r.is_input === true);
  const manufactured = all.filter((r) => r.is_input === false);
  return {
    system:       _sortByConvention(system,       SYSTEM_ORDER),
    manufactured: _sortByConvention(manufactured, MANUFACTURED_ORDER),
  };
}

/**
 * Convenience — is this report ready to render?
 */
export function isReportRenderable(report) {
  return !!report && report.status === 'loaded' && !!report.lineageFrame;
}

/**
 * Convenience — extract a sidebar-friendly status indicator.
 *   'loaded' → ok
 *   'skipped' → missing-deps
 *   'error' → error
 *   anything else → unknown
 */
export function statusIndicator(report) {
  if (!report) return 'unknown';
  if (report.status === 'loaded') return 'ok';
  if (report.status === 'skipped') return 'skipped';
  if (report.status === 'error') return 'error';
  return 'unknown';
}
