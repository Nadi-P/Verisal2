import React from 'react';
import { IconExpand, IconCollapse, IconTrendUp, IconTrendDown } from '../../icons.jsx';
import {
  usePivotTableLogic,
  computeValueCell,
  formatValue,
  checkThreshold,
} from './PivotTable.logic.jsx';
import { useUploadManager } from '../../../contexts/UploadManagerContext.jsx';
import { useTrace } from '../../../contexts/TraceContext.jsx';
import { resolveReportFromRef } from '../../../../lib/uploadManager.js';
import './PivotTable.css';

/** Display label for a value column header (handles deviation entries). */
function valueHeaderLabel(v) {
  if (v && v.deviation) {
    return `${v.name || ''}${v.kind === 'percent' ? ' %' : ''}`.trim() || '—';
  }
  return v.field;
}

const DEPTH_PAD = 20;       // px added to padding-inline-start per depth level
const BASE_PAD  = 12;      // base inline-start padding inside the label cell

/* ===================================================================
   PivotTable — layout only.
   =================================================================== */
export default function PivotTable({
  data, columns, config, onConfigChange, fxRates,
  onCellTrace,
  hasRefsAtCoord,
  focusCoord,
  highlightSet,
  reportId,
}) {
  const { payload } = useUploadManager();
  const trace = useTrace();

  // Persist row-group expansion into the report config (the draft), so
  // leaving + returning restores the exact open tree — parity with table
  // mode. `closing` (exit animation) stays local inside the hook.
  const onExpandedChange = React.useCallback((updater) => {
    if (!onConfigChange) return;
    onConfigChange((prev) => ({
      ...prev,
      expanded: updater(Array.isArray(prev.expanded) ? prev.expanded : []),
    }));
  }, [onConfigChange]);

  // ----------------------------------------------------------------------
  // Single LEFT click → toggle the trace target on a pivot VALUE cell.
  // Only one cell can be the target at a time (matches the single-target
  // semantics of TraceContext), so only ONE refs section is ever expanded.
  // Clicking the current target = deselect: collapse the section + clear
  // the target (cell loses its purple marker).
  // Higher-level aggregates ignore the gesture.
  // ----------------------------------------------------------------------
  const [expandedKey, setExpandedKey] = React.useState(null);
  // While true, the refs section is playing its exit animation before being
  // removed (keeps expandedKey set so the rows still render, marked out).
  // Uses the SAME duration as the tree's collapse so closing the refs looks
  // exactly like collapsing any other expanded section.
  const [refsClosing, setRefsClosing] = React.useState(false);
  const REF_CLOSE_MS = 300;   // must match usePivotTableLogic CLOSE_MS

  const handlePivotCellClick = React.useCallback((e, matchedRows, vDef) => {
    e.stopPropagation();
    if (refsClosing) return;   // ignore clicks mid-close
    if (!Array.isArray(matchedRows) || matchedRows.length !== 1) return;
    const row = matchedRows[0];
    const origRow = typeof row.__origRow === 'number' ? row.__origRow : -1;
    if (origRow < 0) return;
    const colIdx = columns.indexOf(vDef.field);
    if (colIdx < 0) return;
    if (!hasRefsAtCoord || !hasRefsAtCoord(origRow, colIdx)) return;
    const key = `${origRow},${colIdx}`;
    if (expandedKey === key) {
      // Re-click on the current target: animate the refs OUT, then remove
      // the rows + clear the trace target once the animation has finished.
      setRefsClosing(true);
      window.setTimeout(() => {
        setRefsClosing(false);
        setExpandedKey(null);
        trace.closeTrace();
        trace.clearFocus();
      }, REF_CLOSE_MS);
    } else {
      // Move target to this cell. Any previously-expanded cell collapses
      // automatically because the state is a single key.
      setExpandedKey(key);
      if (onCellTrace) onCellTrace(origRow, colIdx);
    }
  }, [onCellTrace, hasRefsAtCoord, columns, expandedKey, trace, refsClosing]);

  // If the trace target was cleared externally (e.g. user closed the side
  // panel, or navigated away), collapse the inline section too.
  React.useEffect(() => {
    if (!focusCoord && !trace.panelTarget && expandedKey != null) {
      setExpandedKey(null);
    }
  }, [focusCoord, trace.panelTarget, expandedKey]);

  // Restore the inline refs section when returning to this report with a
  // live trace target (single global target) — so the pivot looks exactly
  // as the user left it.
  React.useEffect(() => {
    if (focusCoord) {
      setExpandedKey(`${focusCoord.rowIndex},${focusCoord.colIndex}`);
    }
  }, [focusCoord]);

  const L = usePivotTableLogic({ data, config, fxRates, onExpandedChange });

  if (L.isEmpty) {
    return (
      <div className="pivot-table-empty">
        גרור שדות לאזורי השורות/עמודות/ערכים כדי להתחיל
      </div>
    );
  }

  // Lock the label column's width to its worst-case content so it doesn't
  // snap when rows mount/unmount during expand/collapse.
  const labelMinWidth = L.rows.length > 0
    ? `calc(${L.maxRowLabelLength + 1}ch + ${BASE_PAD + Math.max(L.rows.length - 1, 0) * DEPTH_PAD + 12 + 30}px)`
    : undefined;

  return (
    <div className="pivot-table-wrap">
      <table className="pivot-table">
        <thead>
          {/* Column-shelf hierarchy rows */}
          {L.colDims.length > 0 && L.colDims.map((dim, dimIdx) => (
            <tr key={`coldim-${dim}`}>
              {dimIdx === 0 && L.labelColSpan > 0 && (
                <th
                  className="pivot-th pivot-th-corner"
                  rowSpan={L.colDims.length + 1}
                  colSpan={L.labelColSpan}
                  style={{ minWidth: labelMinWidth }}
                />
              )}
              {L.columnPaths.map((path, i) => (
                <th key={`${dim}-${i}`} className="pivot-th pivot-th-col" colSpan={L.values.length}>
                  {String(path[dimIdx] ?? '')}
                </th>
              ))}
            </tr>
          ))}

          {/* Value labels row */}
          <tr>
            {L.colDims.length === 0 && L.labelColSpan > 0 && (
              <th
                className="pivot-th pivot-th-corner"
                colSpan={L.labelColSpan}
                style={{ minWidth: labelMinWidth }}
              />
            )}
            {L.columnPaths.map((_, colI) =>
              L.values.map((v, vi) => {
                const label = valueHeaderLabel(v);
                return (
                  <th
                    key={`v-${colI}-${vi}`}
                    className={`pivot-th pivot-th-value ${v.deviation ? 'is-deviation' : ''}`}
                    style={{ minWidth: `${Math.max(label.length, 8) + 2}ch` }}
                  >
                    {label}
                  </th>
                );
              })
            )}
          </tr>
        </thead>
        <tbody>
          {L.rowTree.length === 0 ? (
            <tr>
              <td className="pivot-empty-row" colSpan={L.labelColSpan + L.totalValueCols}>
                אין נתונים להצגה
              </td>
            </tr>
          ) : (
            renderRows({
              tree: L.rowTree,
              depth: 0,
              parentPath: '',
              parentClosing: false,
              expanded: L.expanded,
              closing: L.closing,
              toggle: L.toggle,
              rowDims: L.rows,
              columnPaths: L.columnPaths,
              values: L.values,
              colDims: L.colDims,
              fxConversions: L.fxConversions,
              thresholds: L.thresholds,
              statQualifyingPerValue: L.statQualifyingPerValue,
              fxRates: L.fxRates,
              deviations: L.deviations,
              regularValues: L.regularValues,
              // Trace plumbing into the value-cell render path.
              columns,
              handlePivotCellClick,
              hasRefsAtCoord,
              focusCoord,
              highlightSet,
              expandedKey,
              refsClosing,
              payload,
              reportId,
              trace,
              totalValueCols: L.totalValueCols,
              labelColSpan: L.labelColSpan,
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ===================================================================
   Recursive row rendering
   =================================================================== */
function renderRows({
  tree, depth, parentPath, parentClosing,
  expanded, closing, toggle,
  rowDims, columnPaths, values, colDims,
  fxConversions, thresholds, statQualifyingPerValue, fxRates,
  deviations, regularValues,
  // Phase 3 trace props (threaded through recursion).
  columns, handlePivotCellClick, hasRefsAtCoord, focusCoord, highlightSet,
  expandedKey, refsClosing, payload, reportId, trace,
  totalValueCols, labelColSpan,
}) {
  if (!Array.isArray(tree)) return [];

  const out = [];
  for (let ni = 0; ni < tree.length; ni++) {
    const node = tree[ni];
    const isLastSibling = ni === tree.length - 1;   // last child → corner connector
    const path = parentPath + '' + node.key;   //  — separator unlikely to appear in keys
    const isOpen = expanded.has(path);
    const isClosing = closing.has(path);
    const isDeepest = depth === rowDims.length - 1;
    const hasChildren = !node.children.__leaf || (node.children.rows && node.children.rows.length > 0);
    const canToggle = hasChildren && !isDeepest;
    const isExpanded = isOpen && !isClosing;     // drives the accent highlight

    const className = [
      'pivot-row',
      `pivot-row-depth-${depth}`,
      canToggle ? 'is-toggleable' : '',
      isExpanded ? 'is-expanded' : '',
    ].filter(Boolean).join(' ');

    out.push(
      <tr
        key={path}
        className={className}
        data-anim={parentClosing ? 'out' : 'in'}
        onClick={canToggle ? () => toggle(path) : undefined}
      >
        <td className="pivot-td pivot-td-label">
            <div
              className="pivot-cell-content"
              style={{ paddingRight: BASE_PAD + depth * DEPTH_PAD }}
            >
              <span className="pivot-row-label">
                <span>{String(node.key)}</span>
                {canToggle && (
                  <span className="pivot-expand-icon" aria-hidden="true">
                    {isOpen ? <IconCollapse size={12} /> : <IconExpand size={12} />}
                  </span>
                )}
              </span>
            </div>

          {/* Single branch connector at this row's own depth (no ancestor
              trunks). The last sibling gets a clipped vertical (└ corner). */}
          {depth >= 1 && (
            <span
              className={`pivot-tree-connector is-branch ${isLastSibling ? 'is-last' : ''}`}
              style={{ right: `${BASE_PAD + (depth - 1) * DEPTH_PAD - 4}px` }}
            />
          )}
        </td>

        {(columnPaths.length === 0 ? [[]] : columnPaths).map((colPath, ci) =>
          values.map((vDef, vi) => {
            const matchedRows = colDims.length === 0
              ? node.rows
              : node.rows.filter((r) => colDims.every((d, i) => r[d] === colPath[i]));
            const result = computeValueCell(matchedRows, vDef, deviations, regularValues, fxConversions, fxRates);

            // Threshold (every level)
            const threshResult = checkThreshold(result, thresholds?.[vDef.field]);
            // Stat highlight (leaf level only — set was built from leaves)
            const statSet = statQualifyingPerValue?.[vi];
            const statPass = statSet ? statSet.has(path) : false;

            // Deviation arrow direction
            const isDev = vDef.deviation === true;
            const arrow = isDev && typeof result === 'number'
              ? (result > 0 ? 'up' : result < 0 ? 'down' : null)
              : null;
            const formatted = formatValue(result, { suffix: isDev && vDef.kind === 'percent' ? '%' : null });

            // Trace metadata: this cell is "traceable" only when it
            // aggregates a single source row (leaf level).
            const isLeafCell  = matchedRows.length === 1;
            const origRow     = isLeafCell && typeof matchedRows[0].__origRow === 'number'
              ? matchedRows[0].__origRow : -1;
            const traceColIdx = columns ? columns.indexOf(vDef.field) : -1;
            const cellHasRefs =
              isLeafCell
              && origRow >= 0
              && traceColIdx >= 0
              && hasRefsAtCoord
              && hasRefsAtCoord(origRow, traceColIdx);
            // In pivot mode the "target" marker IS the expansion state —
            // they're coupled. A cell is purple either because the trace
            // panel is showing it (it's in highlightSet) or because its
            // refs section is open beneath it (expandedKey match).
            const cellKey = `${origRow},${traceColIdx}`;
            const isExpanded = cellHasRefs && expandedKey === cellKey;
            const isHighlighted = cellHasRefs && highlightSet && highlightSet.has(cellKey);

            const cellCls = [
              'pivot-td',
              'pivot-td-value',
              isDev                  ? 'is-deviation'      : '',
              threshResult === true  ? 'is-threshold-pass' : '',
              threshResult === false ? 'is-threshold-fail' : '',
              statPass               ? 'is-stat-pass'      : '',
              cellHasRefs            ? 'has-refs'          : '',
              isHighlighted          ? 'is-refs-expanded'  : '',  // reuse purple style
            ].filter(Boolean).join(' ');
            return (
              <td
                key={`agg-${ci}-${vi}`}
                className={`${cellCls}${isExpanded ? ' is-refs-expanded' : ''}`}
                onClick={
                  cellHasRefs && handlePivotCellClick
                    ? (e) => handlePivotCellClick(e, matchedRows, vDef)
                    : undefined
                }
              >
                <div className="pivot-cell-inner">
                  <div className="pivot-cell-content">
                    {/* Arrow first in DOM → renders on the start-side (right in RTL)
                        of the row, immediately next to the value text. */}
                    {arrow === 'up' && (
                      <span className="pivot-cell-arrow is-up"><IconTrendUp size={10} /></span>
                    )}
                    {arrow === 'down' && (
                      <span className="pivot-cell-arrow is-down"><IconTrendDown size={10} /></span>
                    )}
                    <span className="pivot-cell-text">{formatted}</span>
                  </div>
                </div>
              </td>
            );
          })
        )}
      </tr>
    );

    // Inline ref-row rendering: only at the deepest level, only for the
    // ONE leaf cell whose cellKey matches expandedKey (single-target rule).
    if (isDeepest && expandedKey && node.rows && node.rows.length === 1) {
      const origRow = typeof node.rows[0].__origRow === 'number' ? node.rows[0].__origRow : -1;
      if (origRow >= 0 && payload && payload.reports && reportId) {
        const reportBlock = payload.reports[reportId];
        const lineageColumns = reportBlock && reportBlock.lineageFrame
          ? reportBlock.lineageFrame.columns : null;

        values.forEach((vDef, vi) => {
          const traceColIdx = columns ? columns.indexOf(vDef.field) : -1;
          if (traceColIdx < 0) return;
          const cellKey = `${origRow},${traceColIdx}`;
          if (cellKey !== expandedKey) return;
          if (!lineageColumns) return;
          const lcol = lineageColumns[traceColIdx];
          if (!lcol || !lcol.cells) return;
          const cell = lcol.cells[origRow];
          if (!cell || !Array.isArray(cell.references)) return;

          cell.references.forEach((ref, ri) => {
            const sourceReport = resolveReportFromRef(payload, ref);
            const srcReportBlock = sourceReport ? payload.reports[sourceReport.id] : null;
            const srcColName = srcReportBlock && srcReportBlock.lineageFrame
              ? (srcReportBlock.lineageFrame.columns[ref.c]?.name || '—')
              : '—';
            const srcReportLabel = sourceReport
              ? (sourceReport.display_label || sourceReport.id) : '—';
            const refLabel = `${srcReportLabel} · ${srcColName}`;
            const refVal = ref.v;
            // Position the ref text BELOW the clicked value cell without
            // widening the column: the leading pad spans up to the target
            // column (and carries a zero-width spacer that gives the row its
            // height), and the ref text is absolutely positioned inside the
            // target column's cell — so it adds NO intrinsic width and stays
            // one line. No connectors.
            // (Column index uses the first column-group; the common no-column-
            // dims case lands exactly under the target.)
            const labelSpan  = labelColSpan || 1;
            const beforeSpan = labelSpan + vi;
            const afterSpan  = Math.max((totalValueCols || values.length) - vi - 1, 0);
            out.push(
              <tr
                key={`${path}-ref-${vi}-${ri}`}
                className="pivot-row pivot-ref-row"
                data-anim={(parentClosing || refsClosing) ? 'out' : 'in'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sourceReport && trace) {
                    trace.navigateToRef(sourceReport.id, ref.c, ref.r, reportId);
                  }
                }}
              >
                {/* Leading pad carries the standard collapsible wrapper so the
                    ref row grows/shrinks with the EXACT same animation as any
                    other expanded row (the nbsp gives it a normal line height). */}
                <td className="pivot-td pivot-ref-pad" colSpan={beforeSpan}>
                  <div className="pivot-cell-inner">
                    <div className="pivot-cell-content">{' '}</div>
                  </div>
                </td>
                <td className="pivot-td pivot-ref-cell pivot-ref-label">
                  <span className="pivot-ref-text">
                    <span className="pivot-ref-name">{refLabel}</span>
                    <span className="pivot-ref-sep"> = </span>
                    <span className="pivot-ref-val">{formatValue(refVal, {})}</span>
                  </span>
                </td>
                {afterSpan > 0 && (
                  <td className="pivot-td pivot-ref-pad" colSpan={afterSpan} />
                )}
              </tr>
            );
          });
        });
      }
    }

    if (isOpen && !isDeepest) {
      const childClosing = parentClosing || closing.has(path);
      out.push(...renderRows({
        tree: node.children,
        depth: depth + 1,
        parentPath: path,
        parentClosing: childClosing,
        expanded, closing, toggle,
        rowDims, columnPaths, values, colDims,
        fxConversions, thresholds, statQualifyingPerValue, fxRates,
        deviations, regularValues,
        columns, handlePivotCellClick, hasRefsAtCoord, focusCoord, highlightSet,
        expandedKey, refsClosing, payload, reportId, trace,
        totalValueCols, labelColSpan,
      }));
    }
  }
  return out;
}
