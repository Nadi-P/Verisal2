import React from 'react';
import * as Flags from 'country-flag-icons/react/3x2';

/**
 * Render the SVG flag for an ISO-3166-1 alpha-2 country code, plus EU.
 * Wraps the SVG in a span carrying the styling classes (rounded clip,
 * border, sizing). Falls back to a "?" placeholder for unknown codes.
 *
 * Props:
 *   country   — two-letter code, uppercase (US, EU, GB, ...)
 *   className — extra classes (e.g. "fx-flag-sm")
 */
export default function Flag({ country, className = '' }) {
  const code = (country || '').toUpperCase();
  const Cmp = code && Flags[code];
  return (
    <span className={`fx-flag ${className}`} aria-hidden="true">
      {Cmp
        ? <Cmp className="fx-flag-svg" />
        : <span className="fx-flag-fallback">?</span>}
    </span>
  );
}
