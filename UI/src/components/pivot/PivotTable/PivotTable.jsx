import React from 'react';
import { IconExpand, IconCollapse, IconTrendUp, IconTrendDown } from '../../icons.jsx';
import {
  usePivotTableLogic,
  computeValueCell,
  formatValue,
  checkThreshold,
} from './PivotTable.logic.jsx';
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
export default function PivotTable({ data, columns, config, fxRates }) {
  const L = usePivotTableLogic({ data, config, fxRates });

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
}) {
  if (!Array.isArray(tree)) return [];

  const out = [];
  for (const node of tree) {
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

          {/* Tree connectors (depth >= 1 only) */}
          {depth >= 1 && Array.from({ length: depth }).map((_, d) => {
            const isBranch = d === depth - 1;
            const offset = BASE_PAD + d * DEPTH_PAD - 4;
            return (
              <span
                key={`conn-${d}`}
                className={`pivot-tree-connector ${isBranch ? 'is-branch' : 'is-trunk'}`}
                style={{ right: `${offset}px` }}
              />
            );
          })}
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

            const cellCls = [
              'pivot-td',
              'pivot-td-value',
              isDev                  ? 'is-deviation'      : '',
              threshResult === true  ? 'is-threshold-pass' : '',
              threshResult === false ? 'is-threshold-fail' : '',
              statPass               ? 'is-stat-pass'      : '',
            ].filter(Boolean).join(' ');

            return (
              <td key={`agg-${ci}-${vi}`} className={cellCls}>
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
      }));
    }
  }
  return out;
}
