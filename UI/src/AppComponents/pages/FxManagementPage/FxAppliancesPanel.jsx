import React from 'react';
import ReactDOM from 'react-dom';
import { useUploadManager } from '../../contexts/UploadManagerContext.jsx';
import Flag from './Flag.jsx';
import { CURRENCY_BY_CODE, MONTH_NAMES_HE, formatRateDisplay } from './currencies.js';
import { IconPlus, IconDots, IconBack } from '../../components/icons.jsx';
import ConfirmDialog from '../../components/pivot/PivotSidePanel/ConfirmDialog/ConfirmDialog.jsx';

import { API_BASE } from '../../../lib/apiBase.js';
const REPORT_LABELS = {
  center: 'מרכז שכר', costing: 'תמחיר', income: 'הכנסות זקופות',
  absences: 'היעדרויות', deductions: 'ניכויי רשות', providents: 'קופות גמל',
  components: 'רכיבי שכר', social_analysis: 'אנליזה סוציאלית',
  months_comparison: 'השוואת חודשים', reports_against_center: 'דוחות מול מרכז',
};

/**
 * Sidebar listing every column in every loaded report that currently
 * carries an FX conversion. Items are grouped by report (with the same
 * gradient separator the WelcomePage uses) and each carries a vertical
 * 3-dot menu offering Edit + Remove actions.
 *
 * Props:
 *   ratesByCurrency — the full FX rate map (used to label/edit appliances)
 *   onAddAppliance  — open the Add-Appliance dialog (handled by parent)
 *   onRefreshRates  — bump the shared rates broadcast (used after upsert)
 */
export default function FxAppliancesPanel({ ratesByCurrency, onAddAppliance, onEdit }) {
  const { payload } = useUploadManager();
  const [appliances, setAppliances] = React.useState([]);
  const [confirm, setConfirm] = React.useState(null);
  const [menuOpenFor, setMenuOpenFor] = React.useState(null);

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fx-appliances`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setAppliances(data);
    } catch { /* non-fatal */ }
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  // Re-sync when other parts of the app modify presets / rates.
  React.useEffect(() => {
    const handler = () => reload();
    window.addEventListener('fx-appliances-updated', handler);
    window.addEventListener('fx-rates-updated', handler);
    return () => {
      window.removeEventListener('fx-appliances-updated', handler);
      window.removeEventListener('fx-rates-updated', handler);
    };
  }, [reload]);

  const removeAppliance = async (reportId, field) => {
    try {
      await fetch(`${API_BASE}/api/fx-appliances/${encodeURIComponent(reportId)}/${encodeURIComponent(field)}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('fx-appliances-updated'));
    } catch { /* non-fatal */ }
  };

  // Group by report.
  const byReport = React.useMemo(() => {
    const m = new Map();
    for (const a of appliances) {
      const list = m.get(a.reportId) || [];
      list.push(a);
      m.set(a.reportId, list);
    }
    return m;
  }, [appliances]);

  return (
    <aside className="fx-appliances-panel">
      <div className="fx-appliances-header">
        <span className="fx-appliances-title">הצמדות פעילות</span>
        <button
          type="button"
          className="fx-btn fx-btn-primary fx-btn-sm"
          onClick={onAddAppliance}
        >
          <IconPlus size={14} /> הצמד מטבע
        </button>
      </div>

      {appliances.length === 0 ? (
        <div className="fx-appliances-empty">
          לא הוגדרו הצמדות לאף אחד מהדוחות. לחץ "הצמד מטבע" כדי להתחיל.
        </div>
      ) : (
        <div className="fx-appliances-list">
          {Array.from(byReport.entries()).map(([reportId, list]) => (
            <section key={reportId} className="fx-appliances-section">
              <div className="fx-appliances-section-title">
                <span className="fx-appliances-section-label">
                  {(payload?.reports?.[reportId]?.display_label) || REPORT_LABELS[reportId] || reportId}
                </span>
                <span className="fx-appliances-section-count">{list.length}</span>
                <span className="fx-appliances-section-rule" aria-hidden="true" />
              </div>
              <ul className="fx-appliances-items">
                {list.map((a) => (
                  <ApplianceItem
                    key={`${a.reportId}|${a.field}`}
                    appliance={a}
                    ratesByCurrency={ratesByCurrency}
                    isMenuOpen={menuOpenFor === `${a.reportId}|${a.field}`}
                    onToggleMenu={() => setMenuOpenFor(prev =>
                      prev === `${a.reportId}|${a.field}` ? null : `${a.reportId}|${a.field}`)}
                    onCloseMenu={() => setMenuOpenFor(null)}
                    onEdit={() => { setMenuOpenFor(null); onEdit?.(a); }}
                    onRemove={() => { setMenuOpenFor(null); setConfirm({ reportId: a.reportId, field: a.field, label: a.field }); }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {confirm && ReactDOM.createPortal(
        <ConfirmDialog
          title="הסרת הצמדה"
          message={`להסיר את ההצמדה מהעמודה "${confirm.label}"?`}
          confirmLabel="הסר"
          variant="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await removeAppliance(confirm.reportId, confirm.field);
            setConfirm(null);
          }}
        />,
        document.body,
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
function ApplianceItem({
  appliance, ratesByCurrency, isMenuOpen, onToggleMenu, onCloseMenu,
  onEdit, onRemove,
}) {
  const { field, fxConfig } = appliance;
  const code = fxConfig?.currency || '';
  const cur  = CURRENCY_BY_CODE[code] || null;
  const rate = ratesByCurrency?.[code]?.[String(fxConfig.year)]?.[String(fxConfig.month)];
  const rateText = (typeof rate === 'number') ? formatRateDisplay(rate, cur) : '—';
  const period = (fxConfig.year && fxConfig.month)
    ? `${String(fxConfig.month).padStart(2,'0')}/${fxConfig.year}`
    : '—';

  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!isMenuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onCloseMenu();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isMenuOpen, onCloseMenu]);

  return (
    <li className="fx-appliances-item">
      <div className="fx-appliances-item-flag">
        {cur ? <Flag country={cur.country} className="fx-flag-sm" /> : <span className="fx-appliances-flag-empty">—</span>}
      </div>
      <div className="fx-appliances-item-main">
        <div className="fx-appliances-item-col">{field}</div>
        <div className="fx-appliances-item-meta">
          <span className="fx-appliances-item-rate" dir="ltr">{rateText}</span>
          <span className="fx-appliances-item-sep">·</span>
          <span className="fx-appliances-item-currency">{code || '—'}</span>
          <span className="fx-appliances-item-sep">·</span>
          <span className="fx-appliances-item-period" dir="ltr">{period}</span>
        </div>
      </div>
      <div className="fx-appliances-item-menu-anchor" ref={menuRef}>
        <button
          type="button"
          className="fx-icon-btn"
          onClick={onToggleMenu}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          title="אפשרויות"
        >
          <IconDots size={16} />
        </button>
        {isMenuOpen && (
          <div className="fx-appliances-menu" role="menu">
            <button className="fx-appliances-menu-item" onClick={onEdit}>
              ערוך
            </button>
            <button className="fx-appliances-menu-item fx-appliances-menu-item-danger" onClick={onRemove}>
              הסר
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
