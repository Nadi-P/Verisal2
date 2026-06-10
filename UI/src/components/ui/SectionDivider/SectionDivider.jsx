import React from 'react';
import './SectionDivider.css';

export default function SectionDivider({ label }) {
  if (!label) {
    return <div className="section-divider" />;
  }

  return (
    <div className="section-divider with-label">
      <span className="section-divider-line" />
      <span className="section-divider-label">{label}</span>
      <span className="section-divider-line" />
    </div>
  );
}
