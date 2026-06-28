import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IconDownload, IconSidebar, IconConfig, IconEye, IconReports,
} from '../../../components/icons.jsx';
import DisplayModeToggle from './DisplayModeToggle/DisplayModeToggle.jsx';
import { useReportTopBarLogic } from './ReportTopBar.logic.jsx';
import './ReportTopBar.css';

/**
 * Top bar of the report content area.
 *
 * Export button:
 *   - Left-click  → behaves per the saved `exportFormat`:
 *       'ask'      → opens the format-chooser popup
 *       'custom'   → exports the table view directly (Save-As)
 *       'original' → exports the manufactured report directly (Save-As)
 *   - Right-click → context menu to pick/persist the export format.
 */
export default function ReportTopBar({
  reportTitle,
  metadata,
  displayMode,
  onDisplayModeChange,
  onToggleSidebar,
  exportFormat = 'ask',
  onSetExportFormat,
  onExport,
  canExport = true,
}) {
  const L = useReportTopBarLogic({ metadata });

  const [menu, setMenu]       = useState(null);   // { x, y } | null
  const [askOpen, setAskOpen] = useState(false);
  const [busy, setBusy]       = useState(false);

  const handleExportClick = useCallback(() => {
    if (!canExport || busy) return;
    if (exportFormat === 'ask') {
      setAskOpen(true);
    } else {
      onExport?.(exportFormat);
    }
  }, [canExport, busy, exportFormat, onExport]);

  const handleExportContext = useCallback((e) => {
    e.preventDefault();
    if (!canExport) return;
    setMenu({ x: e.clientX, y: e.clientY });
  }, [canExport]);

  const selectFormat = useCallback((fmt) => {
    onSetExportFormat?.(fmt);
    setMenu(null);
  }, [onSetExportFormat]);

  // From the chooser popup: export, and only close it if a file was saved.
  const chooseAndExport = useCallback(async (fmt) => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await onExport?.(fmt);
      if (saved) setAskOpen(false);
    } finally {
      setBusy(false);
    }
  }, [busy, onExport]);

  return (
    <div className="report-topbar">
      {/* ---- Title block ---- */}
      <div className="report-topbar-title-block">
        <h1 className="report-topbar-title">{reportTitle}</h1>
        <div className="report-topbar-subtitle">
          <span className="report-topbar-dates">{L.dateRange}</span>
          <span className="report-topbar-company">{L.companyName}</span>
        </div>
      </div>

      {/* ---- Controls cluster (visually on the left in RTL) ---- */}
      <div className="report-topbar-controls">
        <button
          type="button"
          className="report-topbar-btn report-topbar-btn-excel"
          title="ייצוא לאקסל (קליק ימני לבחירת פורמט)"
          onClick={handleExportClick}
          onContextMenu={handleExportContext}
          disabled={!canExport}
        >
          <IconDownload size={16} />
          <span>ייצוא לאקסל</span>
        </button>

        <button
          type="button"
          className="report-topbar-btn report-topbar-btn-edit"
          onClick={onToggleSidebar}
          title="תפריט עריכה"
        >
          <IconSidebar size={16} />
          <span>תפריט עריכה</span>
        </button>

        <DisplayModeToggle
          value={displayMode}
          onChange={onDisplayModeChange}
        />
      </div>

      {menu && (
        <ExportFormatMenu
          x={menu.x}
          y={menu.y}
          current={exportFormat}
          onSelect={selectFormat}
          onClose={() => setMenu(null)}
        />
      )}

      {askOpen && (
        <ExportFormatDialog
          busy={busy}
          onChoose={chooseAndExport}
          onClose={() => { if (!busy) setAskOpen(false); }}
        />
      )}
    </div>
  );
}

/* -------- Right-click format menu -------- */
const FORMAT_OPTIONS = [
  { key: 'ask',      label: 'שאל בכל ייצוא',   icon: IconConfig },
  { key: 'custom',   label: 'תצוגה מותאמת',    icon: IconEye },
  { key: 'original', label: 'דוח מקורי',        icon: IconReports },
];

function ExportFormatMenu({ x, y, current, onSelect, onClose }) {
  useEffect(() => {
    const close = () => onClose?.();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="export-format-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {FORMAT_OPTIONS.map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className={`export-format-menu-item ${key === current ? 'is-active' : ''}`}
          onClick={() => onSelect(key)}
        >
          <span className="export-format-menu-icon"><Icon size={14} /></span>
          <span>{label}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* -------- Left-click "ask" chooser popup -------- */
function ExportFormatDialog({ busy, onChoose, onClose }) {
  return createPortal(
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-title">בחר פורמט לייצוא</div>
        <div className="export-dialog-options">
          <button
            type="button"
            className="export-dialog-option"
            onClick={() => onChoose('custom')}
            disabled={busy}
          >
            <IconEye size={22} />
            <span className="export-dialog-option-label">תצוגה מותאמת</span>
            <span className="export-dialog-option-hint">כפי שמוצג בטבלה</span>
          </button>
          <button
            type="button"
            className="export-dialog-option"
            onClick={() => onChoose('original')}
            disabled={busy}
          >
            <IconReports size={22} />
            <span className="export-dialog-option-label">דוח מקורי</span>
            <span className="export-dialog-option-hint">הגרסה המקורית של הדוח</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
