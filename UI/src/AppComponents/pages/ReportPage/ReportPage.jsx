import React from 'react';
import { useReportPageLogic } from './ReportPage.logic.jsx';
import ReportTopBar from './ReportTopBar/ReportTopBar.jsx';
import PivotSidePanel from '../../components/pivot/PivotSidePanel/PivotSidePanel.jsx';
import PivotTable from '../../components/pivot/PivotTable/PivotTable.jsx';
import { TableView } from '../../components/table/index.js';
import { IconReports } from '../../components/icons.jsx';
import { exportReport } from '../../../lib/exportReport.js';
import './ReportPage.css';

export default function ReportPage({ reportId }) {
  const {
    loading,
    error,
    dataLoaded,
    columns,
    data,
    metadata,
    fxRates,
    config,
    setConfig,
    savedPresets,
    defaultName,
    appliedName,
    onOverrideCurrent,
    onSaveNamed,
    onLoadPreset,
    onDeletePreset,
    onRenamePreset,
    onResetToDefault,
    onSetAsDefault,
    sidebarOpen,
    setSidebarOpen,
    displayMode,
    setDisplayMode,
    tableZoom,
    setTableZoom,
    exportFormat,
    setExportFormat,
    uniqueValuesFor,
    toast,
    showToast,
    // Phase 3 trace integration
    hasRefsAtCoord,
    onCellTrace,
    focusCoord,
    highlightSet,
  } = useReportPageLogic(reportId);

  // display_label flows off the Report object (delivered in metadata) — the
  // local title map was retired with the UploadManager migration. Falling
  // back to reportId when the report isn't loaded yet (initial render).
  const title = metadata?.display_label || reportId;

  // Build + save the report workbook. Returns true if saved, false if the
  // user canceled the Save-As dialog (so the format chooser popup can stay
  // open on cancel).
  const handleExport = async (format) => {
    try {
      const saved = await exportReport({
        format, columns, data, config, fxRates, displayName: title,
      });
      if (saved) showToast('הדוח יוצא לאקסל בהצלחה');
      return saved;
    } catch (e) {
      showToast('שגיאה בייצוא הדוח', 'error');
      return false;
    }
  };

  // ReportTopBar is FIXED in place. Only the body content swaps between
  // loading / error / placeholder / pivot / table. The metadata + title
  // update in place because they're props of a persistently-mounted bar.
  const renderBody = () => {
    if (loading) {
      return <div className="report-page-state report-page-loading">טוען נתונים...</div>;
    }
    if (error) {
      return (
        <div className="report-page-state report-page-error">
          <div>שגיאה בטעינת הדוח</div>
          <div className="report-page-error-detail">{error}</div>
        </div>
      );
    }
    if (!dataLoaded) {
      return (
        <div className="report-page-state report-page-placeholder">
          <IconReports size={48} />
          <div className="report-page-placeholder-title">{title}</div>
          <div className="report-page-placeholder-subtitle">
            הדוח עדיין לא נטען. בחר תיקייה הכוללת את הקובץ המתאים מתוך כפתור "העלאת קבצים" בסרגל הצד.
          </div>
        </div>
      );
    }
    if (displayMode === 'pivot') {
      return (
        <PivotTable
          data={data}
          columns={columns}
          config={config}
          onConfigChange={setConfig}
          fxRates={fxRates}
          onCellTrace={onCellTrace}
          hasRefsAtCoord={hasRefsAtCoord}
          focusCoord={focusCoord}
          highlightSet={highlightSet}
          reportId={reportId}
        />
      );
    }
    return (
      <TableView
        data={data}
        columns={columns}
        config={config}
        onConfigChange={setConfig}
        fxRates={fxRates}
        zoom={tableZoom}
        setZoom={setTableZoom}
        onCellTrace={onCellTrace}
        hasRefsAtCoord={hasRefsAtCoord}
        focusCoord={focusCoord}
        highlightSet={highlightSet}
      />
    );
  };

  // Render the side panel only when we have data — there's nothing to edit
  // before that and it avoids flashing the editor during the load phase.
  const showSidePanel = dataLoaded && !loading && !error;

  // Padding on `.report-page-main` is only meaningful in pivot mode; table mode
  // wants the container to span the full content area edge-to-edge so the
  // sticky header and pinned columns butt cleanly against the top bar + side panel.
  const mainCls = `report-page-main${displayMode === 'table' ? ' is-table-mode' : ''}`;

  return (
    <div className="report-page">
      <ReportTopBar
        reportTitle={title}
        metadata={metadata}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        exportFormat={exportFormat}
        onSetExportFormat={setExportFormat}
        onExport={handleExport}
        canExport={dataLoaded}
      />

      <div className="report-page-body">
        <div className={mainCls}>
          {/* Re-key the wrapper on display-mode change so React replaces
              the subtree and the CSS animation fires — content fades in
              from the right (forward-direction screen transition). */}
          <div key={`mode-${displayMode}`} className="report-page-mode-frame">
            {renderBody()}
          </div>
        </div>
        {showSidePanel && (
          <PivotSidePanel
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            displayMode={displayMode}
            currentReportId={reportId}
            allFields={columns}
            uniqueValuesFor={uniqueValuesFor}
            config={config}
            onConfigChange={setConfig}
            savedPresets={savedPresets}
            defaultName={defaultName}
            appliedName={appliedName}
            onOverrideCurrent={onOverrideCurrent}
            onSaveNamed={onSaveNamed}
            onLoadPreset={onLoadPreset}
            onDeletePreset={onDeletePreset}
            onRenamePreset={onRenamePreset}
            onResetToDefault={onResetToDefault}
            onSetAsDefault={onSetAsDefault}
            showToast={showToast}
          />
        )}
      </div>

      {toast && (
        <div className={`report-page-toast report-page-toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
