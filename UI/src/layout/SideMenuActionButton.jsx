import React from 'react';

function ActionButton({ icon, label, onClick, style }) {
  return (
    <button className="sidebar-action-button" onClick={onClick} style={style}>
      {icon && <img alt="" src={icon} className="sidebar-button-icon" />}
      <span className="button-label">{label}</span>
    </button>
  );
}

export { ActionButton };
