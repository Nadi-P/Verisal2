import React from 'react';
import { useSidebarButtonLogic } from './SidebarButton.logic.jsx';
import './SidebarButton.css';

export default function SidebarButton({ id, label, icon, isActive, onClick }) {
  const { handleClick } = useSidebarButtonLogic({ id, onClick });

  return (
    <button
      className={`sidebar-button ${isActive ? 'is-active' : ''}`}
      onClick={handleClick}
    >
      {icon && <span className="sidebar-button-icon">{icon}</span>}
      <span className="sidebar-button-label">{label}</span>
    </button>
  );
}
