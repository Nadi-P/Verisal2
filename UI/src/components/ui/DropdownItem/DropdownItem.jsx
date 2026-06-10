import React from 'react';
import { useDropdownItemLogic } from './DropdownItem.logic.jsx';
import './DropdownItem.css';

export default function DropdownItem({ id, label, isActive, onClick }) {
  const { handleClick } = useDropdownItemLogic({ id, onClick });

  return (
    <div
      className={`dropdown-item ${isActive ? 'is-active' : ''}`}
      onClick={handleClick}
    >
      <span className="dropdown-item-label">{label}</span>
    </div>
  );
}
