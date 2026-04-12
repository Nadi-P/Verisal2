import React from 'react';
import FilterMenu from './FilterMenu.jsx';
import { useAuditTableLogic } from '../logic/AuditTableLogic.jsx';
import '../style/AuditTable.css';

function AuditTable({
  rowData, allRowData, isLoading,
  visibleColumns, pinnedColumns,
  sortState, filterState,
  onSortFilter, zoom, onSelectionStats,
  checkupData,
  reportsLoaded, loadError, onLoadReports
}) {
  const {
    tableContainerRef,
    displayColumns,
    displayRows,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    handleKeyDown,
    isCellSelected,
    selectionBorderClass,
    getStickyOffset,
    isPinned,
    // Sort
    handleSort,
    getSortIcon,
    // Filter
    filterMenuState,
    openFilterMenu,
    closeFilterMenu,
    applyFilter,
    getUniqueValues,
    // Formatting
    formatCellValue,
    getTextDirection,
    // Zoom
    getCellStyle,
    getHeaderStyle,
    getCellCheckupColor,
    // Column highlights / pin measurement
    isColumnFiltered,
    isColumnSorted,
    setPinnedHeaderRef,
  } = useAuditTableLogic({
    rowData, allRowData,
    visibleColumns, pinnedColumns,
    sortState, filterState,
    onSortFilter, zoom, onSelectionStats,
    checkupData
  });

  if (isLoading) {
    return (
      <div className="table-message">
        <div className="loading-spinner" />
        <span>טוען דוח...</span>
      </div>
    );
  }

  if (!reportsLoaded && (!rowData || rowData.length === 0)) {
    return (
      <div className="table-message">
        <div className="load-reports-center">
          <svg className="load-reports-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="load-reports-prompt">טען תיקיית דוחות להתחלה</span>
          <button className="load-reports-btn" onClick={onLoadReports}>
            טעינת דוחות
          </button>
          {loadError && <div className="load-error-message">{loadError}</div>}
        </div>
      </div>
    );
  }

  if (!rowData || rowData.length === 0) {
    return (
      <div className="table-message">
        <div className="load-reports-center">
          <svg className="load-reports-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="load-reports-prompt">הדוחות נטענו בהצלחה — בחר דוח מהתפריט הצדדי</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tableContainerRef}
      className="audit-table-container"
      onMouseUp={handleMouseUp}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <table className="audit-table">
        <thead>
          <tr>
            {displayColumns.map((col, colIndex) => {
              const pinned = isPinned(col);
              const stickyOffset = getStickyOffset(col);
              const filtered = isColumnFiltered(col);
              const sorted = isColumnSorted(col);
              const headerClass =
                `table-header-cell${pinned ? ' pinned' : ''}${filtered ? ' filtered' : ''}${sorted ? ' sorted' : ''}`;
              return (
                <th
                  key={col}
                  ref={pinned ? setPinnedHeaderRef(col) : null}
                  className={headerClass}
                  style={{
                    ...getHeaderStyle(),
                    ...(pinned ? { position: 'sticky', right: stickyOffset, zIndex: 12 } : {}),
                  }}
                >
                  <div className="header-content">
                    <span className="header-text" title={col}>{col}</span>
                    <div className="header-actions">
                      <button
                        className={`header-btn sort-btn${sorted ? ' active' : ''}`}
                        onClick={() => handleSort(col)}
                        title="מיין"
                      >
                        {getSortIcon(col)}
                      </button>
                      <button
                        className={`header-btn filter-btn${filtered ? ' active' : ''}`}
                        onClick={(e) => openFilterMenu(col, e)}
                        title="סנן"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {displayColumns.map((col, colIndex) => {
                const selected = isCellSelected(rowIndex, colIndex);
                const borderClasses = selectionBorderClass(rowIndex, colIndex);
                const pinned = isPinned(col);
                const stickyOffset = getStickyOffset(col);
                const checkupClass = getCellCheckupColor(row, col) || '';
                const filteredCol = isColumnFiltered(col) ? 'filtered-col' : '';
                const sortedCol = isColumnSorted(col) ? 'sorted-col' : '';
                const value = row[col];
                const formatted = formatCellValue(value);
                const dir = getTextDirection(formatted);

                return (
                  <td
                    key={col}
                    className={`table-cell ${checkupClass} ${selected ? 'selected' : ''} ${borderClasses} ${pinned ? 'pinned' : ''} ${filteredCol} ${sortedCol}`}
                    style={{
                      ...getCellStyle(),
                      direction: dir,
                      textAlign: dir === 'rtl' ? 'right' : 'left',
                      ...(pinned ? { position: 'sticky', right: stickyOffset, zIndex: 3 } : {}),
                    }}
                    onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
                    onMouseEnter={(e) => handleMouseEnter(rowIndex, colIndex, e)}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {filterMenuState.open && (
        <FilterMenu
          columnId={filterMenuState.columnId}
          allValues={getUniqueValues(filterMenuState.columnId)}
          currentFilter={filterState[filterMenuState.columnId]}
          onApply={(selectedValues) => applyFilter(filterMenuState.columnId, selectedValues)}
          onCancel={closeFilterMenu}
          position={filterMenuState.position}
        />
      )}
    </div>
  );
}

export default AuditTable;
