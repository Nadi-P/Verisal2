import React from 'react';
import './PagePlaceholder.css';

export default function PagePlaceholder({ icon, title, subtitle }) {
  return (
    <div className="page-placeholder">
      {icon && <span className="page-placeholder-icon">{icon}</span>}
      <span className="page-placeholder-title">{title}</span>
      {subtitle && <span className="page-placeholder-subtitle">{subtitle}</span>}
    </div>
  );
}
