import React from 'react';
import { useUploadManager } from '../../contexts/UploadManagerContext.jsx';
import {
  IconUpload, IconReports, IconManufactured, IconLoading,
} from '../../components/icons.jsx';
import './WelcomePage.css';
import verisalIcon from '../../../public/verisal-icon.svg';
import verisalIconInverted from '../../../public/verisal-icon-inverted.svg';

const VERISAL_ICON = verisalIcon;
const VERISAL_ICON_INVERTED = verisalIconInverted;

/**
 * Two-faced coin: front = normal icon, back = inverted icon (pre-rotated
 * 180deg). Hovering the wrap spins the coin a single 360deg turn — the
 * inverted face shows through the middle (~90deg→270deg), flipping back to
 * normal as it completes. Re-hover to replay.
 */
function LogoCoin() {
  return (
    <div className="welcome-logo-coin">
      <div className="welcome-logo-face welcome-logo-front">
        <img src={VERISAL_ICON} alt="Verisal" className="welcome-logo" />
      </div>
      <div className="welcome-logo-face welcome-logo-back">
        <img src={VERISAL_ICON_INVERTED} alt="" aria-hidden="true" className="welcome-logo" />
      </div>
    </div>
  );
}

const SYSTEM_ORDER = [
  'center', 'costing', 'income', 'absences', 'deductions', 'providents', 'components',
];
const MANUFACTURED_ORDER = [
  'social_analysis', 'months_comparison', 'reports_against_center',
];

const REPORT_LABELS = {
  center: 'מרכז שכר', costing: 'תמחיר', income: 'הכנסות זקופות',
  absences: 'היעדרויות', deductions: 'ניכויי רשות', providents: 'קופות גמל',
  components: 'רכיבי שכר', social_analysis: 'אנליזה סוציאלית',
  months_comparison: 'השוואת חודשים', reports_against_center: 'דוחות מול מרכז',
};

const PAGE_LOADING = 'loading-management';
const SYSTEM_COLS       = 4;
const MANUFACTURED_COLS = 3;

/**
 * Welcome page — the app's home, also serving as the empty / loading /
 * error UI before any data exists. States are derived from the upload
 * state machine:
 *
 *   - empty      : no payload yet and no upload in flight → big centered
 *                  upload button + greeting.
 *   - loading    : upload in flight → same layout, cards shimmer in
 *                  place, upload button is replaced by a Cancel button
 *                  carrying the spinner.
 *   - canceling  : user pressed Cancel → spinner keeps running, button
 *                  reads "מבטל…", everything else holds in shimmer mode
 *                  until the backend settles.
 *   - loaded     : payload present → real report cards in the same
 *                  layout, secondary upload button at the top.
 *   - error      : standalone error screen (no sidebar, no greeting
 *                  block).
 *
 * Transitions between states cross-fade via the .welcome-stage key.
 */
export default function WelcomePage({ onNavigate }) {
  const {
    payload, hydrating,
    uploadState, uploadFiles, stopUpload, clearUploadState,
  } = useUploadManager();
  const fileInputRef = React.useRef(null);
  const [osUser, setOsUser] = React.useState(null);

  React.useEffect(() => {
    try {
      const api = window.electronAPI;
      if (api && typeof api.getOSUser === 'function') {
        const name = api.getOSUser();
        if (name) setOsUser(String(name));
      }
    } catch (_e) { /* no-op */ }
  }, []);

  const triggerUpload = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesSelected = React.useCallback(async (e) => {
    const all = Array.from(e.target.files || []);
    if (all.length > 0) await uploadFiles(all);
    e.target.value = '';
  }, [uploadFiles]);

  // Auto-dismiss toast a few seconds after success/error (matches the
  // ReportPage toast timing).
  React.useEffect(() => {
    if (uploadState && (uploadState.kind === 'success' || uploadState.kind === 'error')) {
      const t = setTimeout(clearUploadState, 3500);
      return () => clearTimeout(t);
    }
  }, [uploadState, clearUploadState]);

  const isLoading   = uploadState && uploadState.kind === 'loading';
  const isCanceling = uploadState && uploadState.kind === 'stopping';
  const isBusy      = isLoading || isCanceling;
  const isFatalError =
    uploadState
    && uploadState.kind === 'error'
    && (uploadState.errorKind === 'server' || uploadState.errorKind === 'processing')
    && !payload;
  const hasPayload = !!payload;

  /* --------------- ERROR SCREEN (no payload + fatal error) -------- */
  if (isFatalError) {
    const isServer = uploadState.errorKind === 'server';
    return (
      <div className="welcome-page welcome-error" data-stage="error">
        <input
          ref={fileInputRef} className="welcome-upload-input"
          type="file" webkitdirectory="" directory="" multiple
          onChange={onFilesSelected}
        />
        <div className="welcome-stage welcome-stage-enter">
          <div className="welcome-logo-wrap welcome-logo-error">
            <LogoCoin />
          </div>
          <div className="welcome-error-title">
            {isServer ? 'אירעה תקלה בשרת' : 'תהליך הטעינה לא הושלם'}
          </div>
          <div className="welcome-error-message">{uploadState.message}</div>
          {uploadState.detail && (
            <pre className="welcome-error-detail">{uploadState.detail}</pre>
          )}
          <button
            className="welcome-upload-btn welcome-upload-btn-primary welcome-upload-btn-big"
            onClick={triggerUpload}
          >
            <IconUpload size={22} />
            <span>העלאת קבצים מחדש</span>
          </button>
        </div>
      </div>
    );
  }

  /* --------------- HOME (empty / loading / loaded) ---------------- */
  const greeting = osUser ? `שלום, ${osUser}` : 'ברוכים הבאים';
  const lookup = (hasPayload && payload.reports) ? payload.reports : {};
  const sysCards  = SYSTEM_ORDER.map((id) => buildCard(id, lookup, 'system'));
  const manuCards = MANUFACTURED_ORDER.map((id) => buildCard(id, lookup, 'manufactured'));
  const showSections = hasPayload || isBusy;

  // Pick a stage key so React re-mounts the stage on state changes and
  // the cross-fade animation runs.
  const stageKey =
    !showSections ? 'empty'
    : (isBusy     ? 'busy'
    :  'loaded');

  return (
    <div
      className={`welcome-page welcome-home ${showSections ? '' : 'is-empty'}`}
      data-stage={stageKey}
    >
      <input
        ref={fileInputRef} className="welcome-upload-input"
        type="file" webkitdirectory="" directory="" multiple
        onChange={onFilesSelected}
      />

      <div key={stageKey} className="welcome-stage welcome-stage-enter">
        <header className="welcome-header">
          <div className="welcome-logo-wrap">
            <LogoCoin />
          </div>
          <div className="welcome-greeting">{greeting}</div>
          {!hasPayload && !isBusy && !hydrating && (
            <div className="welcome-subtitle">
              כדי להתחיל, לחצו על הכפתור והעלו את תיקיית הקבצים שלכם.
            </div>
          )}
          {hasPayload && !isBusy && (
            <div className="welcome-subtitle">
              הקבצים נטענו בהצלחה. בחרו דוח מהקטגוריות שלמטה.
            </div>
          )}
          {isLoading && (
            <div className="welcome-subtitle welcome-subtitle-busy">
              <span className="welcome-inline-spinner" aria-hidden="true" />
              מעבד את הקבצים...
            </div>
          )}
          {isCanceling && (
            <div className="welcome-subtitle welcome-subtitle-busy">
              <span className="welcome-inline-spinner" aria-hidden="true" />
              מבטל...
            </div>
          )}
        </header>

        {/* ---- Action button: upload OR cancel ---- */}
        {isBusy ? (
          <button
            className="welcome-upload-btn welcome-upload-btn-cancel"
            onClick={stopUpload}
            disabled={isCanceling}
          >
            <span className="welcome-btn-spinner" aria-hidden="true" />
            <span>{isCanceling ? 'מבטל...' : 'בטל טעינה'}</span>
          </button>
        ) : !hasPayload ? (
          <button
            className="welcome-upload-btn welcome-upload-btn-primary welcome-upload-btn-big"
            onClick={triggerUpload}
          >
            <IconUpload size={28} />
            <span>העלאת קבצים</span>
          </button>
        ) : (
          <button
            className="welcome-upload-btn welcome-upload-btn-secondary"
            onClick={triggerUpload}
          >
            <IconUpload size={18} />
            העלאת קבצים חדשה
          </button>
        )}

        {/* ---- Sections (only when payload exists OR loading is busy) ---- */}
        {showSections && (
          <>
            <SectionShell
              icon={<IconReports size={18} />}
              title="דוחות מערכת"
              count={hasPayload
                ? `${sysCards.filter((c) => c.loaded).length} / ${sysCards.length}`
                : `${SYSTEM_ORDER.length}`}
              cols={SYSTEM_COLS}
            >
              {sysCards.map((c, i) => (
                <ReportCard
                  key={c.id} card={c} index={i} busy={isBusy}
                  onClick={() => !isBusy && c.loaded && onNavigate?.({ type: 'report', id: c.id })}
                />
              ))}
            </SectionShell>

            <SectionShell
              icon={<IconManufactured size={18} />}
              title="דוחות מיוצרים"
              count={hasPayload
                ? `${manuCards.filter((c) => c.loaded).length} / ${manuCards.length}`
                : `${MANUFACTURED_ORDER.length}`}
              cols={MANUFACTURED_COLS}
            >
              {manuCards.map((c, i) => (
                <ReportCard
                  key={c.id} card={c} index={sysCards.length + i}
                  busy={isBusy}
                  onClick={() => !isBusy && c.loaded && onNavigate?.({ type: 'report', id: c.id })}
                />
              ))}
            </SectionShell>

            {hasPayload && !isBusy && (
              <button
                className="welcome-secondary-link"
                onClick={() => onNavigate?.({ type: 'page', id: PAGE_LOADING })}
              >
                <IconLoading size={16} />
                לפרטי הטעינה המלאים
              </button>
            )}
          </>
        )}
      </div>

      {/* Toast — uses the ReportPage toast classes verbatim. */}
      {uploadState && uploadState.kind === 'success' && (
        <div className="report-page-toast report-page-toast-success">
          {uploadState.message}
        </div>
      )}
      {uploadState && uploadState.kind === 'error' && hasPayload && (
        <div className="report-page-toast report-page-toast-error">
          {uploadState.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function buildCard(id, lookup, group) {
  const r = lookup[id];
  return {
    id, group,
    label:   (r && r.display_label) || REPORT_LABELS[id] || id,
    loaded:  !!(r && r.status === 'loaded'),
    present: !!r,
  };
}

function SectionShell({ icon, title, count, cols, children }) {
  return (
    <section className="welcome-section">
      <div className="welcome-section-title">
        <span className="welcome-section-title-icon">{icon}</span>
        <span className="welcome-section-title-label">{title}</span>
        <span className="welcome-section-title-count">{count}</span>
        <span className="welcome-section-title-rule" aria-hidden="true" />
      </div>
      <div className="welcome-card-grid" style={{ '--cols': cols }}>
        {children}
      </div>
    </section>
  );
}

function ReportCard({ card, index, onClick, busy }) {
  const disabled = busy || !card.loaded;
  return (
    <button
      type="button"
      className={[
        'welcome-card',
        disabled  ? 'is-disabled'  : '',
        busy      ? 'is-busy'      : '',
        !busy && !card.loaded ? 'is-errored' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
      style={{ '--i': index }}
      title={!busy && !card.loaded
        ? 'הדוח לא נוצר. ראו את מסך פרטי הטעינה למידע נוסף.'
        : undefined}
    >
      {/* Real content always present underneath; the .is-busy overlay
          covers it with a shimmer while loading. */}
      <span className="welcome-card-content">
        {!busy && !card.loaded && (
          <span className="welcome-card-state">שגיאה</span>
        )}
        <span className="welcome-card-icon">
          <IconReports size={22} />
        </span>
        <span className="welcome-card-label">{card.label}</span>
      </span>
      <span className="welcome-card-shimmer" aria-hidden="true" />
    </button>
  );
}
