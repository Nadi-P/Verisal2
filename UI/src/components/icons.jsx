/* ==========================================================================
   Verisal — Placeholder SVG Icons
   Replace these with custom SVGs later.
   All icons accept { size, color, className } props.
   ========================================================================== */
import React from 'react';

const defaultProps = { size: 20, color: 'currentColor' };

export function IconReports({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function IconManufactured({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function IconCreateReport({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function IconConfig({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function IconLoading({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconChevronDown({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconDashboard({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function IconSearch({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconAnomalies({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconUpload({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 5 17 10" />
      <line x1="12" y1="5" x2="12" y2="16" />
    </svg>
  );
}

export function IconCollapse({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconExpand({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconPlus({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconMinus({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 12} height={size || 12} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconTrash({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 15} height={size || 15} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function IconX({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconReset({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

export function IconBars({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function IconTag({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconBack({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* RTL: "back" points to the right */}
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 19 19 12 12 5" />
    </svg>
  );
}

export function IconDots({ size, color, className } = defaultProps) {
  // Vertical kebab-style three-dot menu glyph.
  return (
    <svg className={className} width={size || 10} height={size || 10} viewBox="0 0 24 24" fill={color || 'currentColor'} stroke="none">
      <circle cx="12" cy="5"  r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

export function IconDownload({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconSidebar({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

export function IconTrendUp({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 12} height={size || 12} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="18" x2="18" y2="6" />
      <polyline points="9 6 18 6 18 15" />
    </svg>
  );
}

export function IconTrendDown({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 12} height={size || 12} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <polyline points="18 9 18 18 9 18" />
    </svg>
  );
}

export function IconPin({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill={color || 'currentColor'} stroke="none">
      <path d="M14 4l6 6-3 1.5-1.5 4.5-2-2-5 5-1.5-1.5 5-5-2-2 4.5-1.5z" />
    </svg>
  );
}

export function IconPinOff({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4l6 6-3 1.5-1.5 4.5-2-2-5 5-1.5-1.5 5-5-2-2 4.5-1.5z" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

export function IconSortAsc({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconSortDesc({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

export function IconSortNone({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7-7 7 7" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

export function IconEye({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.79 19.79 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconGrip({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill={color || 'currentColor'} stroke="none">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

/* FX management — currency-exchange double arrow */
export function IconFxManagement({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/* History — clock with backwards arrow */
export function IconHistory({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

/* Footsteps — re-open the most-recent traceback screen. */
export function IconFootsteps({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="7"  cy="6"  rx="2.2" ry="2.6" />
      <path d="M5 9.5c-.8 1 -.7 2.2 .2 3.1 c1.0 1.0 1.2 1.7 1.0 3.0" />
      <ellipse cx="16" cy="11" rx="2.2" ry="2.6" />
      <path d="M14 14.5c-.8 1 -.7 2.2 .2 3.1 c1.0 1.0 1.2 1.7 1.0 3.0" />
    </svg>
  );
}

/* IconSwap — double-arrow used by the FX direction toggle. */
export function IconSwap({ size, color, className } = defaultProps) {
  return (
    <svg className={className} width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
