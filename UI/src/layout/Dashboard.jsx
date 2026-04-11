import React from 'react';
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
    currentReportTitle,
    // Comparison props from global state
    compData, setCompData,
    handleRunComparison
  } = useAppState();

  return (
    <div className="app-container">
      <SideMenu
        isOpen={sideMenuOpen}
        onToggle={() => setSideMenuOpen(prev => !prev)}
        setTableData={setRowData}
        setIsLoading={setIsLoading}
        setMetadata={setMetadata}
        setColumns={setColumns}
        setCheckupData={setCheckupData}
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
        />
      </div>
    </div>
  );
}

export default Dashboard;