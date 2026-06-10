import { useState, useCallback, useRef } from 'react';

// Empty base = relative URLs → Vite dev server proxies /api/* to uvicorn.
// Avoids cross-origin CORS / PNA issues entirely.
const API_BASE = '';

const REPORT_LABELS = {
  center:                 'מרכז שכר',
  components:             'רכיבי שכר',
  deductions:             'ניכויי רשות',
  income:                 'הכנסות זקופות',
  absences:               'היעדרויות',
  providents:             'קופות גמל',
  costing:                'תמחיר',
  social_analysis:        'אנליזה סוציאלית',
  months_comparison:      'השוואת חודשים',
  reports_against_center: 'דוחות מול מרכז',
};

const labelFor = (id) => REPORT_LABELS[id] || id;

/**
 * Build a UI status object from the /api/folder/set response.
 * Mixed outcomes (some loaded, some missing/errored) get type 'warning'.
 */
function buildFolderStatus(body) {
  const loaded = body.loaded || [];
  const missing = body.missing || [];
  const errors = body.errors || {};
  const unrecognized = body.unrecognized || [];
  const duplicates = body.duplicates || [];

  if (loaded.length === 0) {
    return {
      type: 'error',
      message: 'לא נטענו קבצים. ודא שהתיקייה מכילה קבצי Excel בשמות מתאימים.',
    };
  }

  const lines = [`נטענו ${loaded.length} מתוך ${loaded.length + missing.length} קבצים`];
  if (missing.length) {
    lines.push(`חסרים: ${missing.map(labelFor).join(', ')}`);
  }
  if (Object.keys(errors).length) {
    lines.push(`שגיאות: ${Object.keys(errors).map(labelFor).join(', ')}`);
  }
  if (duplicates.length) {
    lines.push(`כפילויות: ${duplicates.join(', ')}`);
  }
  if (unrecognized.length) {
    lines.push(`לא מזוהה: ${unrecognized.join(', ')}`);
  }

  const hasIssues = missing.length || Object.keys(errors).length || duplicates.length || unrecognized.length;
  return {
    type: hasIssues ? 'warning' : 'success',
    message: lines.join('\n'),
  };
}

/* -------------------------------------------------------------------
   Report definitions — single source of truth for sidebar navigation
   ------------------------------------------------------------------- */

export const SYSTEM_REPORTS = [
  { id: 'center',      label: 'מרכז שכר' },
  { id: 'costing',     label: 'תמחיר' },
  { id: 'income',      label: 'הכנסות' },
  { id: 'absences',    label: 'היעדרויות' },
  { id: 'deductions',  label: 'ניכויים' },
  { id: 'providents',  label: 'קופות גמל' },
  { id: 'components',  label: 'רכיבי שכר' },
];

export const MANUFACTURED_REPORTS = [
  { id: 'social_analysis',        label: 'אנליזה סוציאלית' },
  { id: 'months_comparison',      label: 'השוואת חודשים' },
  { id: 'reports_against_center', label: 'דוחות מול מרכז' },
];

export const PAGE_IDS = {
  DASHBOARD:           'dashboard',
  CREATE_REPORT:       'create-report',
  LOADING_MANAGEMENT:  'loading-management',
  CONFIGURATION:       'configuration',
  ANOMALIES:           'anomalies',
};

export const DROPDOWN_IDS = {
  SYSTEM:       'system-reports',
  MANUFACTURED: 'manufactured-reports',
};

/* -------------------------------------------------------------------
   Hook
   ------------------------------------------------------------------- */

export function useSidebarLogic({ activePage, onNavigate }) {
  /* ---- Collapse / expand ---- */
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  /* ---- Accordion: only one dropdown open at a time ---- */
  const [openDropdownId, setOpenDropdownId] = useState(DROPDOWN_IDS.SYSTEM);

  const toggleDropdown = useCallback((dropdownId) => {
    setOpenDropdownId((prev) => (prev === dropdownId ? null : dropdownId));
  }, []);

  /* ---- Navigation ---- */
  const handleReportClick = useCallback((reportId) => {
    if (onNavigate) onNavigate({ type: 'report', id: reportId });
  }, [onNavigate]);

  const handlePageClick = useCallback((pageId) => {
    if (onNavigate) onNavigate({ type: 'page', id: pageId });
  }, [onNavigate]);

  const handleLogoClick = useCallback(() => {
    if (onNavigate) onNavigate({ type: 'page', id: PAGE_IDS.DASHBOARD });
  }, [onNavigate]);

  /* ---- File upload ---- */
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleUploadClick = useCallback(() => {
    // HTML input with webkitdirectory shows a folder picker in Electron/Chrome.
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (e) => {
    const inputEl = e.target;
    const all = Array.from(inputEl.files || []);
    if (all.length === 0) return;

    // Filter to Excel files only — the folder may contain unrelated junk.
    const excel = all.filter((f) => /\.(xlsx|xls)$/i.test(f.name));
    if (excel.length === 0) {
      inputEl.value = '';
      setUploadStatus({ type: 'error', message: 'לא נמצאו קבצי Excel בתיקייה שנבחרה' });
      return;
    }

    setUploadStatus({ type: 'loading', message: 'טוען קבצים...' });

    try {
      // Snapshot every File into an in-memory Blob BEFORE building FormData.
      // Files from <input webkitdirectory> are live OS handles in Chromium;
      // by the time fetch streams the multipart body, those handles can be
      // invalidated → fetch aborts internally and surfaces as ERR_FAILED
      // with the request never leaving the browser. Reading arrayBuffer()
      // up-front decouples us from the live handle entirely.
      const snapshots = await Promise.all(
        excel.map(async (f) => ({
          name: f.name,
          blob: new Blob([await f.arrayBuffer()], {
            type: f.type || 'application/octet-stream',
          }),
        }))
      );

      const form = new FormData();
      snapshots.forEach(({ name, blob }) => form.append('files', blob, name));

      const res = await fetch(`${API_BASE}/api/upload_reports`, {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadStatus({ type: 'error', message: body.detail || body.message || 'שגיאה בטעינת הקבצים' });
      } else {
        setUploadStatus(buildFolderStatus(body));
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: `שגיאת רשת: ${err.message}` });
    } finally {
      inputEl.value = '';
    }
  }, []);

  return {
    collapsed,
    toggleCollapse,
    systemReports: SYSTEM_REPORTS,
    manufacturedReports: MANUFACTURED_REPORTS,
    openDropdownId,
    toggleDropdown,
    handleReportClick,
    handlePageClick,
    handleLogoClick,
    handleUploadClick,
    handleFilesSelected,
    fileInputRef,
    uploadStatus,
    activePage,
  };
}
