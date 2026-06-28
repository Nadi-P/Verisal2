// Base URL for all backend (/api/...) requests.
//
// - Dev: '' (relative) so the Vite dev server proxies /api/* to uvicorn
//   (sidesteps CORS + Chrome's Private Network Access checks).
// - Packaged Electron app: the page is loaded from file://, where a relative
//   '/api/...' would resolve to file:///api/... and fail. Talk to the local
//   backend directly. (The backend's CORS allows the "null" origin that
//   file:// pages send.)
export const API_BASE =
  (typeof window !== 'undefined'
   && window.location
   && window.location.protocol === 'file:')
    ? 'http://localhost:8000'
    : '';
