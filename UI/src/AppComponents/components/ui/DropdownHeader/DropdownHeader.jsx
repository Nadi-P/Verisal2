import React from 'react';
import { useDropdownHeaderLogic } from './DropdownHeader.logic.jsx';
import { IconChevronDown } from '../../icons.jsx';
import './DropdownHeader.css';

export default function DropdownHeader({ label, icon, isOpen, onToggle }) {
  const { handleClick } = useDropdownHeaderLogic({ isOpen, onToggle });

  return (
    <div
      className={`dropdown-header ${isOpen ? 'is-open' : ''}`}
      onClick={handleClick}
    >
      {icon && <span className="dropdown-header-icon">{icon}</span>}
      <span className="dropdown-header-label">{label}</span>
      <span className="dropdown-header-chevron">
        <IconChevronDown size={14} />
      </span>
    </div>
  );
}
