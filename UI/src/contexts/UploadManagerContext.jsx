/**
 * UploadManagerContext — process-wide source of truth for the parsed
 * Reports + per-report cell data shipped by the backend, AND the source
 * of truth for ongoing upload state (so Sidebar + WelcomePage + any
 * other consumer share one state machine).
 *
 * uploadState shape:
 *   { kind: 'idle' | 'loading' | 'stopping' | 'success' | 'error',
 *     message?: string, errorKind?: 'server' | 'processing', detail?: string }
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

import {
  bucketReports, getReport as _getReport,
} from '../lib/uploadManager.js';

const API_BASE = '';

const UploadManagerContext = createContext(null);

const IDLE_STATE = { kind: 'idle' };

export function UploadManagerProvider({ children }) {
  const [payload, setPayload] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [uploadState, setUploadState] = useState(IDLE_STATE);

  // Generation counter — incremented on every fresh upload so that
  // the *current* request can tell whether its response is stale (the
  // user stopped this upload or fired another mid-flight).
  const uploadGen = useRef(0);

  // Persist the most-recent SUCCESS toast briefly so the welcome
  // screen can render it without us having to wire a separate toast
  // context. UI clears it after read.
  const clearUploadState = useCallback(() => setUploadState(IDLE_STATE), []);

  // Hydrate once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/upload_manager`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        if (body && body.loaded && body.uploadManager) {
          setPayload(body.uploadManager);
        }
      } catch (e) {
        if (!cancelled) console.warn('UploadManager hydrate failed:', e);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setHydrating(true);
    try {
      const res = await fetch(`${API_BASE}/api/upload_manager`);
      if (!res.ok) return;
      const body = await res.json();
      if (body && body.loaded && body.uploadManager) {
        setPayload(body.uploadManager);
      } else {
        setPayload(null);
      }
    } catch (e) {
      console.warn('UploadManager refresh failed:', e);
    } finally {
      setHydrating(false);
    }
  }, []);

  /**
   * Kick off an upload from a list of File objects. Returns nothing —
   * progress is reflected in `uploadState`. Replaces any in-flight
   * upload (the user can only have one upload in flight).
   */
  const uploadFiles = useCallback(async (fileList) => {
    const excel = (fileList || []).filter((f) => /\.(xlsx|xls)$/i.test(f.name));
    if (excel.length === 0) {
      setUploadState({
        kind: 'error', errorKind: 'processing',
        message: 'לא נמצאו קבצי Excel בתיקייה שנבחרה',
      });
      return;
    }

    const myGen = ++uploadGen.current;
    setUploadState({ kind: 'loading', message: 'טוען קבצים...' });

    try {
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
        method: 'POST', body: form,
      });
      // Stale-response guard: if user stopped or started another upload
      // mid-flight, just drop this response.
      if (myGen !== uploadGen.current) return;
      const body = await res.json().catch(() => ({}));
      if (myGen !== uploadGen.current) return;
      if (!res.ok) {
        setUploadState({
          kind: 'error', errorKind: 'server',
          message: body.detail || body.message || 'שגיאה בטעינת הקבצים',
        });
        return;
      }
      if (body.uploadManager) {
        setPayload(body.uploadManager);
      }
      // Inspect the processed result for any catastrophic errors.
      const legacy = body.legacy || body;
      const reportErrors = legacy.errors || {};
      const errorReportIds = Object.keys(reportErrors);
      if (errorReportIds.length > 0 && (!legacy.loaded || legacy.loaded.length === 0)) {
        setUploadState({
          kind: 'error', errorKind: 'processing',
          message: 'לא ניתן היה לעבד את הקבצים',
          detail: errorReportIds.map((k) => `${k}: ${reportErrors[k]}`).join('\n'),
        });
        return;
      }
      setUploadState({ kind: 'success', message: 'הטעינה הושלמה בהצלחה' });
    } catch (err) {
      if (myGen !== uploadGen.current) return;
      setUploadState({
        kind: 'error', errorKind: 'server',
        message: `שגיאת רשת: ${err.message}`,
      });
    }
  }, []);

  /**
   * Stop button. We don't actually abort the backend request (the
   * pipeline runs synchronously inside one HTTP call), but we:
   *   1. Mark the upload generation stale so the response (if it ever
   *      returns) is silently dropped.
   *   2. Keep showing a "stopping" animation long enough for the
   *      backend to settle, then return to idle. This avoids two
   *      uploads racing if the user immediately re-uploads.
   */
  const stopUpload = useCallback(() => {
    uploadGen.current += 1;  // any in-flight response now stale
    setUploadState({ kind: 'stopping', message: 'מסיים תהליך...' });
    // Give the backend ~6s to finish (the pipeline is <2s at typical
    // employee counts; this is a generous cushion).
    setTimeout(() => {
      setUploadState((s) => (s.kind === 'stopping' ? IDLE_STATE : s));
    }, 6000);
  }, []);

  const value = useMemo(() => ({
    payload,
    hydrating,
    isLoaded:   !!payload,
    metadata:   payload?.metadata || null,
    getReport:  (id) => _getReport(payload, id),
    getBuckets: () => bucketReports(payload),
    setPayload,
    refresh,

    // Upload workflow
    uploadState,
    uploadFiles,
    stopUpload,
    clearUploadState,
  }), [payload, hydrating, refresh, uploadState, uploadFiles, stopUpload, clearUploadState]);

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (ctx == null) {
    throw new Error(
      'useUploadManager() must be used inside <UploadManagerProvider>'
    );
  }
  return ctx;
}
