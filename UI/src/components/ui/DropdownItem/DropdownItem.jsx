import React from 'react';
import { useDropdownItemLogic } from './DropdownItem.logic.jsx';
import './DropdownItem.css';

export default function DropdownItem({ id, label, isActive, disabled, onClick }) {
  const { handleClick } = useDropdownItemLogic({ id, onClick });

  return (
    <div
      className={`dropdown-item ${isActive ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : handleClick}
      aria-disabled={disabled || undefined}
    >
      <span className="dropdown-item-label">{label}</span>
    </div>
  );
}
