import { useState, useCallback, useRef, useMemo, useEffect } from 'react';

import { useUploadManager } from '../../../contexts/UploadManagerContext.jsx';
import { statusIndicator } from '../../../../lib/uploadManager.js';

import { API_BASE } from '../../../../lib/apiBase.js';

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
   Default/empty sidebar lists — used before an upload happens. Once an
   UploadManager payload exists, the buckets are derived from it directly
   (see useSidebarLogic below). These statics fall back when payload is
   null so the empty sidebar still renders the expected categories.
   ------------------------------------------------------------------- */

export const SYSTEM_REPORTS = [
  { id: 'center',      label: 'מרכז שכר',     status: null },
  { id: 'costing',     label: 'תמחיר',         status: null },
  { id: 'income',      label: 'הכנסות',        status: null },
  { id: 'absences',    label: 'היעדרויות',     status: null },
  { id: 'deductions',  label: 'ניכויים',       status: null },
  { id: 'providents',  label: 'קופות גמל',     status: null },
  { id: 'components',  label: 'רכיבי שכר',     status: null },
];

export const MANUFACTURED_REPORTS = [
  { id: 'social_analysis',        label: 'אנליזה סוציאלית',  status: null },
  { id: 'months_comparison',      label: 'השוואת חודשים',     status: null },
  { id: 'reports_against_center', label: 'דוחות מול מרכז',   status: null },
];

export const PAGE_IDS = {
  DASHBOARD:           'dashboard',
  LOADING_MANAGEMENT:  'loading-management',   // legacy id, label is now "ניהול העלאות"
  FX_MANAGEMENT:       'fx-management',
  HISTORY:             'history',
  AXIOLOGY:            'axiology',
  LOADING_TABLE:       'loading_table',          // manufactured report id (matches backend)
  LOADING_VS_CENTER:   'loading-vs-center',      // future report (placeholder)
};

export const DROPDOWN_IDS = {
  SYSTEM:       'system-reports',
  MANUFACTURED: 'manufactured-reports',
  LOADING:      'loading-dropdown',
};

const SYSTEM_REPORT_IDS = new Set([
  'center', 'costing', 'income', 'absences', 'deductions',
  'providents', 'components',
]);
const MANUFACTURED_REPORT_IDS = new Set([
  'social_analysis', 'months_comparison', 'reports_against_center',
]);
const LOADING_REPORT_IDS = new Set([
  'loading_table', 'loading-vs-center',
]);

/* -------------------------------------------------------------------
   Hook
   ------------------------------------------------------------------- */

export function useSidebarLogic({ activePage, onNavigate }) {
  const { payload, uploadFiles, uploadState } = useUploadManager();

  /* ---- Derived reports — pulled off UploadManager when available, fall
         back to the empty const lists otherwise. Each item carries an
         indicator: 'ok' | 'skipped' | 'error' | 'unknown' | null. ---- */
  const { systemReports, manufacturedReports } = useMemo(() => {
    if (!payload || !payload.reports) {
      return {
        systemReports:       SYSTEM_REPORTS,
        manufacturedReports: MANUFACTURED_REPORTS,
      };
    }
    const SYSTEM_ORDER = [
      'center', 'costing', 'income', 'absences', 'deductions',
      'providents', 'components',
    ];
    const MANUFACTURED_ORDER = [
      'social_analysis', 'months_comparison', 'reports_against_center',
    ];

    const all = Object.values(payload.reports);
    const byId = new Map(all.map((r) => [r.id, r]));

    const pick = (ids) =>
      ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => ({
          id:       r.id,
          label:    r.display_label || r.id,
          status:   statusIndicator(r),
          disabled: !!r.disabled,
        }));

    return {
      systemReports:       pick(SYSTEM_ORDER),
      manufacturedReports: pick(MANUFACTURED_ORDER),
    };
  }, [payload]);

  /* ---- Collapse / expand ---- */
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  /* ---- Accordion: only one dropdown open at a time ----
         When activePage points at a report (e.g. via programmatic nav from
         a trace ref-click), force the dropdown containing that report open
         so the user sees their location in the tree. Single-open invariant
         is preserved either way. */
  const [openDropdownId, setOpenDropdownId] = useState(DROPDOWN_IDS.SYSTEM);

  const toggleDropdown = useCallback((dropdownId) => {
    setOpenDropdownId((prev) => (prev === dropdownId ? null : dropdownId));
  }, []);

  useEffect(() => {
    if (!activePage || activePage.type !== 'report') return;
    const id = activePage.id;
    if (SYSTEM_REPORT_IDS.has(id))            setOpenDropdownId(DROPDOWN_IDS.SYSTEM);
    else if (MANUFACTURED_REPORT_IDS.has(id)) setOpenDropdownId(DROPDOWN_IDS.MANUFACTURED);
    else if (LOADING_REPORT_IDS.has(id))      setOpenDropdownId(DROPDOWN_IDS.LOADING);
  }, [activePage]);

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

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (e) => {
    const inputEl = e.target;
    const all = Array.from(inputEl.files || []);
    if (all.length > 0) {
      await uploadFiles(all);
    }
    inputEl.value = '';
  }, [uploadFiles]);

  // Map central uploadState → the sidebar's old status-banner shape so
  // existing banner CSS keeps working without rewrites.
  const uploadStatus = useMemo(() => {
    if (!uploadState) return null;
    if (uploadState.kind === 'idle') return null;
    if (uploadState.kind === 'success') return { type: 'success', message: uploadState.message || '' };
    if (uploadState.kind === 'error')   return { type: 'error',   message: uploadState.message || '' };
    if (uploadState.kind === 'loading' || uploadState.kind === 'stopping') {
      return { type: 'loading', message: uploadState.message || '' };
    }
    return null;
  }, [uploadState]);

  return {
    collapsed,
    toggleCollapse,
    systemReports,
    manufacturedReports,
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
