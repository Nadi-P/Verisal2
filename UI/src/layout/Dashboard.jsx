import React, { useRef, useCallback } from 'react';
import SideMenu from './SideMenu.jsx';
import TopStatusBar from './TopStatusBar.jsx';
import BottomStatusBar from './BottomStatusBar.jsx';
import AuditTable from './AuditTable.jsx';
import ColumnsPanel from './ColumnsPanel.jsx';
import { useAppState } from '../logic/AppLogic.jsx';

function Dashboard() {
  const {
    rowData, setRowData,
    filteredData,
    isLoading, setIsLoading,
    metadata, setMetadata,
    zoom, setZoom,
    sideMenuOpen, setSideMenuOpen,
    columnsPanelOpen, setColumnsPanelOpen,
    columns, setColumns,
    visibleColumns,
    pinnedColumns,
    sortState,
    filterState,
    selectionStats,
    setSelectionStats,
    checkupData, setCheckupData,
    handleColumnsApply,
    handleSortFilter,
    clearAllFilters,
    hasActiveFilters,
    currentReportTitle,
    reportsLoaded, setReportsLoaded,
    loadError, setLoadError,
    // Comparison props from global state
    compData, setCompData,
    handleRunComparison
  } = useAppState();

  const fileInputRef = useRef(null);

  const triggerLoadReports = useCallback(() => {
    // Reset the input so re-selecting the same folder still fires onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFilesSelected = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoadError('');
    setIsLoading(true);

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const uploadRes = await fetch('http://localhost:8000/api/upload_reports', {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadRes.json();

      if (uploadResult.status !== 'success') {
        setLoadError(uploadResult.message || 'שגיאה בטעינת הדוחות');
        setIsLoading(false);
        return;
      }

      // Upload succeeded
      setReportsLoaded(true);
      setLoadError('');

      // If a report was already selected, reload it with the new data
      const activeReport = metadata.reportFileName;
      if (activeReport) {
        const reportRes = await fetch(`http://localhost:8000/api/get_report?report_name=${activeReport}`);
        const reportResult = await reportRes.json();

        if (reportResult.status === 'success') {
          setRowData(reportResult.data);
          setMetadata(prev => ({
            ...prev,
            companyName: reportResult.metadata.company_name,
            dateRange: `${reportResult.metadata.min_month}/${reportResult.metadata.min_year} - ${reportResult.metadata.max_month}/${reportResult.metadata.max_year}`,
            minMonth: reportResult.metadata.min_month,
            minYear: reportResult.metadata.min_year,
            maxMonth: reportResult.metadata.max_month,
            maxYear: reportResult.metadata.max_year,
          }));
          if (reportResult.data.length > 0) {
            const keys = Object.keys(reportResult.data[0]);
            setCheckupData(reportResult.checkup || {});
            setColumns(keys.map(k => ({ id: k, visible: true, pinned: false })));
          } else {
            setColumns([]);
          }
        }
      } else {
        // No report selected yet — just show a success message in the table area
        setRowData([]);
        setColumns([]);
      }
    } catch (error) {
      setLoadError('שגיאה בחיבור לשרת');
    } finally {
      setIsLoading(false);
    }
  }, [setRowData, setIsLoading, metadata, setMetadata, setColumns, setCheckupData, setReportsLoaded, setLoadError]);

  const handleExportExcel = useCallback(async () => {
    if (!metadata.reportFileName) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/export_report?report_name=${metadata.reportFileName}`
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();

      // Build default filename: {report name} {start}-{end}.xlsx
      const startDate = `${metadata.minMonth}.${metadata.minYear}`;
      const endDate = `${metadata.maxMonth}.${metadata.maxYear}`;
      const defaultName = `${metadata.reportTitle} ${startDate}-${endDate}.xlsx`;

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Excel Files',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Fallback for browsers without File System Access API
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      // AbortError means user cancelled the save dialog — not an error
      if (error.name !== 'AbortError') {
        console.error('Export failed:', error);
      }
    }
  }, [metadata]);

  const controlsDisabled = !reportsLoaded;

  return (
    <div className="app-container">
      {/* Hidden folder picker input */}
      <input
        ref={fileInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />

      <SideMenu
        isOpen={sideMenuOpen}
        onToggle={() => setSideMenuOpen(prev => !prev)}
        setTableData={setRowData}
        setIsLoading={setIsLoading}
        setMetadata={setMetadata}
        setColumns={setColumns}
        setCheckupData={setCheckupData}
        reportsLoaded={reportsLoaded}
        loadError={loadError}
        onLoadReports={triggerLoadReports}
      />

      <div className="main-content">
        <TopStatusBar
          metadata={metadata}
          currentReport={currentReportTitle}
          columns={columns}
          columnsPanelOpen={columnsPanelOpen}
          onToggleColumns={() => setColumnsPanelOpen(prev => !prev)}
          // Passing comparison state and handlers
          compData={compData}
          setCompData={setCompData}
          onRunComparison={handleRunComparison}
          // Filter + export actions
          onClearFilters={clearAllFilters}
          hasActiveFilters={hasActiveFilters}
          onExportExcel={handleExportExcel}
          disabled={controlsDisabled}
        />

        <div className="app-middle">
          <div className="table-area">
            <AuditTable
              rowData={filteredData}
              allRowData={rowData}
              isLoading={isLoading}
              visibleColumns={visibleColumns}
              pinnedColumns={pinnedColumns}
              sortState={sortState}
              filterState={filterState}
              onSortFilter={handleSortFilter}
              zoom={zoom}
              onSelectionStats={setSelectionStats}
              checkupData={checkupData}
              reportsLoaded={reportsLoaded}
              loadError={loadError}
              onLoadReports={triggerLoadReports}
            />
          </div>

          <ColumnsPanel
            isOpen={columnsPanelOpen}
            columns={columns}
            onApply={handleColumnsApply}
            onCancel={() => setColumnsPanelOpen(false)}
          />
        </div>

        <BottomStatusBar
          zoom={zoom}
          setZoom={setZoom}
          selectionStats={selectionStats}
          disabled={controlsDisabled}
        />
      </div>
    </div>
  );
}

export default Dashboard;
