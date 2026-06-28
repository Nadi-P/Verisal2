import React from 'react';
import ReactDOM from 'react-dom';
import { useAxiologyLogic } from './AxiologyPage.logic.jsx';
import { IconPlus, IconSearch, IconDots } from '../../components/icons.jsx';
import ConfirmDialog from '../../components/pivot/PivotSidePanel/ConfirmDialog/ConfirmDialog.jsx';
import './AxiologyPage.css';

/**
 * Component-code catalog (axiology).
 *
 * Header: title + total counter + per-category counters + search bar + "הוסף קוד".
 * Body  : tabbed list of codes (all + one tab per record type).
 *         Each row: code | name | vertical 3-dot menu (edit / remove).
 *
 * Add / Edit reuse the same dialog; Remove goes through a confirm dialog
 * that mentions any references (referenced-by feature reserved for the
 * future Loading-Table report — for now it's always "not referenced").
 */
export default function AxiologyPage() {
  const L = useAxiologyLogic();
  if (L.loading) {
    return (
      <div className="ax-page">
        <div className="ax-loading">טוען קטלוג רכיבים...</div>
      </div>
    );
  }

  const rtKeys = Object.keys(L.data.recordTypes);

  return (
    <div className="ax-page">
      <header className="ax-header">
        <div className="ax-title-block">
          <h1 className="ax-title">אקסיולוגיה</h1>
          <p className="ax-subtitle">ניהול קודי הרכיבים, מסווגים לפי סוגי רשומה.</p>
        </div>

        <div className="ax-header-controls">
          <div className="ax-search">
            <IconSearch size={16} />
            <input
              type="text"
              className="ax-search-input"
              placeholder="חיפוש לפי קוד או שם..."
              value={L.query}
              onChange={(e) => L.setQuery(e.target.value)}
              dir="rtl"
            />
            {L.query && (
              <button
                className="ax-search-clear"
                type="button"
                onClick={() => L.setQuery('')}
                aria-label="נקה חיפוש"
              >×</button>
            )}
          </div>
          <button
            className="ax-btn ax-btn-primary"
            onClick={() => L.openAdd(L.activeCategory)}
          >
            <IconPlus size={16} /> הוסף קוד
          </button>
        </div>
      </header>

      <CategoryTabs
        recordTypes={L.data.recordTypes}
        counts={L.countsByRecordType}
        totalCount={L.totalCount}
        active={L.activeCategory}
        onChange={L.setActiveCategory}
      />

      <div className="ax-list">
        {L.filteredEntries.length === 0 ? (
          <div className="ax-empty">
            {L.query.trim() ? 'לא נמצאו קודים התואמים את החיפוש' : 'אין קודים בקטגוריה הזו'}
          </div>
        ) : (
          L.filteredEntries.map((entry) => (
            <EntryRow
              key={`${entry.recordType}|${entry.code}`}
              entry={entry}
              showRecordType={L.activeCategory == null}
              onEdit={() => L.openEdit(entry)}
              onRemove={() => L.setConfirm({ ...entry })}
            />
          ))
        )}
      </div>

      {L.dialog && ReactDOM.createPortal(
        <EditDialog
          dialog={L.dialog}
          recordTypes={L.data.recordTypes}
          isCodeAvailable={L.isCodeAvailable}
          onClose={L.closeDialog}
          onSave={async (payload) => {
            const ok = await L.upsertEntry(payload);
            if (ok) L.closeDialog();
          }}
        />,
        document.body,
      )}

      {L.confirm && ReactDOM.createPortal(
        <ConfirmDialog
          title="הסרת קוד"
          message={`להסיר את הקוד "${L.confirm.code} — ${L.confirm.name}" מ-${L.confirm.recordTypeLabel}? לא נמצאו הפניות לקוד זה.`}
          confirmLabel="הסר"
          variant="danger"
          onCancel={L.closeConfirm}
          onConfirm={async () => {
            await L.removeEntry(L.confirm);
            L.closeConfirm();
          }}
        />,
        document.body,
      )}

      {L.toast && (
        <div className={`report-page-toast report-page-toast-${L.toast.type}`}>
          {L.toast.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/**
 * Tab strip with a single sliding underline that animates under the
 * active tab. No box borders — just text + count on a baseline. The
 * underline element is positioned absolutely; its `left` + `width`
 * track the active tab's bounding box (recomputed on every change of
 * active/counts/window-resize).
 */
function CategoryTabs({ recordTypes, counts, totalCount, active, onChange }) {
  const tabRefs = React.useRef({});
  const containerRef = React.useRef(null);
  const [underline, setUnderline] = React.useState({ left: 0, width: 0, ready: false });

  const measure = React.useCallback(() => {
    const key = active == null ? '__all' : String(active);
    const el  = tabRefs.current[key];
    const c   = containerRef.current;
    if (!el || !c) return;
    const r  = el.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    setUnderline({ left: r.left - cr.left, width: r.width, ready: true });
  }, [active]);

  React.useLayoutEffect(() => { measure(); }, [measure, recordTypes, counts]);
  React.useEffect(() => {
    const onR = () => measure();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [measure]);

  const tabKeys = ['__all', ...Object.keys(recordTypes)];

  return (
    <div className="ax-tabs" role="tablist" ref={containerRef}>
      {tabKeys.map((key) => {
        const isAll = key === '__all';
        const isActive = isAll ? active == null : active === key;
        return (
          <button
            key={key}
            ref={(el) => { tabRefs.current[key] = el; }}
            className={`ax-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange(isAll ? null : key)}
            title={isAll ? 'הכל' : recordTypes[key]}
            role="tab"
            aria-selected={isActive}
          >
            <span className="ax-tab-label">{isAll ? 'הכל' : recordTypes[key]}</span>
            <span className="ax-tab-count">{isAll ? totalCount : (counts[key] || 0)}</span>
          </button>
        );
      })}
      <div
        className="ax-tabs-underline"
        style={{
          left:  `${underline.left}px`,
          width: `${underline.width}px`,
          opacity: underline.ready ? 1 : 0,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EntryRow({ entry, showRecordType, onEdit, onRemove }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div
      className="ax-row"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      {/* Code displayed as `<recordType>-<code>` so the category prefix
          is always visible (mirrors the spreadsheet's CONCAT column). */}
      <span className="ax-row-code">{entry.recordType}{entry.code}</span>
      <div className="ax-row-main">
        <span className="ax-row-name">{entry.name}</span>
        {showRecordType && (
          <span className="ax-row-rt">{entry.recordTypeLabel}</span>
        )}
      </div>
      <div className="ax-row-menu-anchor" ref={menuRef}>
        <button
          type="button"
          className="ax-icon-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="אפשרויות"
        >
          <IconDots size={16} />
        </button>
        {menuOpen && (
          <div className="ax-row-menu" role="menu">
            <button className="ax-row-menu-item" onClick={() => { setMenuOpen(false); onEdit(); }}>
              ערוך
            </button>
            <button className="ax-row-menu-item ax-row-menu-item-danger" onClick={() => { setMenuOpen(false); onRemove(); }}>
              הסר
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EditDialog({ dialog, recordTypes, isCodeAvailable, onClose, onSave }) {
  const isEdit = dialog.mode === 'edit';
  const [recordType, setRecordType] = React.useState(dialog.recordType || '');
  const [codeInput, setCodeInput]   = React.useState(String(dialog.code ?? ''));
  const [name, setName]             = React.useState(dialog.name || '');
  // Edit-mode confirmation step before committing the change.
  const [confirmingEdit, setConfirmingEdit] = React.useState(false);

  // Snapshot of the initial values (captured ONCE on open) so the edit
  // dialog can disable Save when nothing has changed.
  const initialRef = React.useRef({
    recordType: dialog.recordType || '',
    code:       String(dialog.code ?? ''),
    name:       dialog.name || '',
  });

  const codeNum = parseInt(codeInput, 10);
  const codeValid =
    Number.isInteger(codeNum)
    && codeNum > 0
    && String(codeNum) === codeInput.trim();
  const nameValid = name.trim().length > 0;

  // Uniqueness: editing → ignore own old code; adding → must not collide.
  const recordTypeValid = !!recordType;
  const uniquenessOk = recordTypeValid && codeValid
    ? isCodeAvailable(recordType, codeNum, isEdit ? dialog.oldCode : null)
    : true;

  // Pristine = every input still matches the initial snapshot. Edit mode
  // requires the user to have CHANGED at least one field before saving.
  const pristine =
    recordType === initialRef.current.recordType
    && codeInput.trim() === initialRef.current.code.trim()
    && name.trim() === initialRef.current.name.trim();

  const allValid = recordTypeValid && codeValid && nameValid && uniquenessOk
    && (!isEdit || !pristine);

  const submit = () => {
    if (!allValid) return;
    if (isEdit) {
      setConfirmingEdit(true);
      return;
    }
    onSave({
      recordType,
      code: codeNum,
      name: name.trim(),
    });
  };

  const finalizeEdit = () => {
    onSave({
      recordType,
      oldCode: dialog.oldCode,
      code: codeNum,
      name: name.trim(),
    });
  };

  return (
    <div className="ax-overlay" onClick={onClose}>
      <div className="ax-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="ax-dialog-header">
          <span className="ax-dialog-title">{isEdit ? 'עריכת קוד' : 'הוספת קוד'}</span>
        </header>
        <div className="ax-dialog-body">
          <label className="ax-field">
            <span className="ax-field-label">סוג רשומה</span>
            <select
              className="ax-input"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
            >
              <option value="">בחר סוג רשומה...</option>
              {Object.entries(recordTypes).map(([rt, label]) => (
                <option key={rt} value={rt}>{label}</option>
              ))}
            </select>
          </label>
          <label className="ax-field">
            <span className="ax-field-label">קוד</span>
            <input
              type="text" inputMode="numeric" dir="ltr"
              className={`ax-input ${codeInput && !codeValid ? 'is-invalid' : ''}`}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="לדוגמה: 1"
            />
            {codeInput && codeValid && !uniquenessOk && (
              <span className="ax-field-error">הקוד כבר קיים בסוג רשומה זה</span>
            )}
          </label>
          <label className="ax-field">
            <span className="ax-field-label">שם הרכיב</span>
            <input
              type="text" dir="rtl"
              className={`ax-input ${name && !nameValid ? 'is-invalid' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: שכר יסוד"
            />
          </label>
        </div>
        <footer className="ax-dialog-actions">
          <button type="button" className="ax-btn ax-btn-ghost" onClick={onClose}>ביטול</button>
          <button
            type="button"
            className="ax-btn ax-btn-primary"
            disabled={!allValid}
            onClick={submit}
            title={isEdit && pristine ? 'לא בוצעו שינויים' : undefined}
          >שמור</button>
        </footer>
      </div>

      {confirmingEdit && ReactDOM.createPortal(
        <ConfirmDialog
          title="אישור עריכה"
          message={`לעדכן את הקוד? לפני: "${initialRef.current.code} — ${initialRef.current.name}". אחרי: "${codeInput.trim()} — ${name.trim()}".`}
          confirmLabel="אשר ושמור"
          variant="danger"
          onCancel={() => setConfirmingEdit(false)}
          onConfirm={() => { setConfirmingEdit(false); finalizeEdit(); }}
        />,
        document.body,
      )}
    </div>
  );
}
