import React from 'react';

function ActionButton({ icon, label, onClick, style, uploadButton }) {
  return (
    <button className={`sidebar-action-button ${uploadButton ? 'upload-btn' : ''}`} onClick={onClick} style={style}>
      {uploadButton ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-button-svg-icon">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ) : (
        icon && <img alt="" src={icon} className="sidebar-button-icon" />
      )}
      <span className="button-label">{label}</span>
    </button>
  );
}

export { ActionButton };
