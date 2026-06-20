/**
 * TraceContext — app-wide lineage-trace state.
 *
 * State:
 *   panelTarget — { reportId, columnIdx, rowIdx } | null
 *     The cell whose lineage is shown in the side panel. Updated ONLY on
 *     double-right-click; ref-click navigation does NOT change it (so the
 *     side panel keeps showing the original cell's chain while the user
 *     navigates through sources).
 *
 *   focusTarget — { reportId, columnIdx, rowIdx } | null
 *     The cell to scroll-to + highlight in the currently-viewed table.
 *     Updated on BOTH double-right-click and on a ref-click that targets a
 *     cell in the active report. Cleared when the user navigates away by
 *     clicking the sidebar or after the highlight auto-fades.
 *
 *   navigateRequest — { reportId } | null
 *     Pushed when a ref-click points at a DIFFERENT report. Consumed by
 *     MainLayout-level navigation glue, which translates it into an
 *     onNavigate({ type: 'report', id }) call, preserving displayMode.
 *
 * Helpers:
 *   resolvePanelView(payload) → null | {
 *     report, columnName, value, formula, references: [{ ref, sourceReport }]
 *   }
 *     Combines panelTarget + the live UploadManager payload to compute the
 *     full data the side panel needs (column name resolved, references
 *     enriched with their source-report metadata). Pure derived data.
 *
 * The setters always replace the entire target — there's no partial mutation.
 */
import React, {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

import { resolveReportFromRef } from '../lib/uploadManager.js';

const TraceContext = createContext(null);

export function TraceProvider({ children }) {
  const [panelTarget,     setPanelTarget]     = useState(null);
  const [focusTarget,     setFocusTarget]     = useState(null);
  const [navigateRequest, setNavigateRequest] = useState(null);
  // Last-viewed trace target — survives a closeTrace so the user can
  // reopen the same trace screen via the side-panel footsteps button.
  const [lastTrace,       setLastTrace]       = useState(null);
  // `forcedDisplayMode`: while the user is navigating through references
  // (focusTarget !== panelTarget) we force 'table' mode so the trace UI
  // is always shown in the tabular view. Clicking the top meta block of
  // the calc-info screen returns focus to the panel target and clears
  // the force — the report falls back to whatever displayMode the user
  // had before triggering the trace.
  const [forcedDisplayMode, setForcedDisplayMode] = useState(null);

  const openTraceFor = useCallback((target) => {
    setPanelTarget(target);
    setFocusTarget(target);
    setLastTrace(target);
    setForcedDisplayMode(null); // start at the target = user's own mode
  }, []);

  const closeTrace = useCallback(() => {
    setPanelTarget(null);
    setForcedDisplayMode(null);
  }, []);

  /**
   * Ref-click handler. If the click moves focus AWAY from the panel
   * target → force 'table' mode while the user explores the lineage.
   * If the click returns focus TO the panel target (e.g. user pressed
   * the meta-block at the top of the calc-info screen) → clear the
   * force, letting the user's original displayMode show again.
   */
  const navigateToRef = useCallback((targetReportId, columnIdx, rowIdx, currentReportId) => {
    const nextTarget = { reportId: targetReportId, columnIdx, rowIdx };
    setFocusTarget(nextTarget);
    if (targetReportId !== currentReportId) {
      setNavigateRequest({ reportId: targetReportId, ts: Date.now() });
    }
    setForcedDisplayMode(prev => {
      // If navigating to the same cell that owns the panel = "back to
      // original" → release the force.
      if (panelTarget
          && panelTarget.reportId === targetReportId
          && panelTarget.columnIdx === columnIdx
          && panelTarget.rowIdx === rowIdx) {
        return null;
      }
      return 'table';
    });
  }, [panelTarget]);

  const consumeNavigateRequest = useCallback(() => {
    setNavigateRequest(null);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusTarget(null);
  }, []);

  /** Footsteps button — reopen the most-recent trace screen. */
  const reopenLastTrace = useCallback(() => {
    if (!lastTrace) return;
    setPanelTarget(lastTrace);
    setFocusTarget(lastTrace);
    setForcedDisplayMode(null);
  }, [lastTrace]);

  const value = useMemo(() => ({
    panelTarget, focusTarget, navigateRequest, lastTrace, forcedDisplayMode,
    openTraceFor, closeTrace, navigateToRef, consumeNavigateRequest, clearFocus,
    reopenLastTrace,
  }), [panelTarget, focusTarget, navigateRequest, lastTrace, forcedDisplayMode,
       openTraceFor, closeTrace, navigateToRef, consumeNavigateRequest, clearFocus,
       reopenLastTrace]);

  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>;
}

export function useTrace() {
  const ctx = useContext(TraceContext);
  if (ctx == null) {
    throw new Error('useTrace() must be used inside <TraceProvider>');
  }
  return ctx;
}

/**
 * Pure helper — combines panelTarget + the live UploadManager payload
 * into everything the CalculationInfoScreen needs to render.
 */
export function resolvePanelView(payload, panelTarget) {
  if (!payload || !payload.reports || !panelTarget) return null;
  const report = payload.reports[panelTarget.reportId];
  if (!report || !report.lineageFrame) return null;

  const col = report.lineageFrame.columns[panelTarget.columnIdx];
  if (!col) return null;

  const cell = (col.cells || [])[panelTarget.rowIdx];
  if (!cell) return null;

  // Resolve each reference's source-column NAME by looking up the source
  // report's lineageFrame.columns[ref.c]. Cheap O(1) lookups via payload.
  const references = (cell.references || []).map((ref) => {
    const sourceReport = resolveReportFromRef(payload, ref);
    let sourceColumnName = null;
    if (sourceReport && payload.reports) {
      const srcReportBlock = payload.reports[sourceReport.id];
      if (srcReportBlock && srcReportBlock.lineageFrame) {
        const srcCol = srcReportBlock.lineageFrame.columns[ref.c];
        if (srcCol) sourceColumnName = srcCol.name;
      }
    }
    return { ref, sourceReport, sourceColumnName };
  });

  return {
    report:        { id: report.id, display_label: report.display_label },
    columnName:    col.name,
    columnIdx:     panelTarget.columnIdx,
    rowIdx:        panelTarget.rowIdx,
    value:         cell.value,
    formula:       col.formula || null,
    references,
  };
}
