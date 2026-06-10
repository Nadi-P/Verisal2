import React from 'react';
import DropdownHeader from '../DropdownHeader/DropdownHeader.jsx';
import DropdownItem from '../DropdownItem/DropdownItem.jsx';
import './Dropdown.css';

export default function Dropdown({ label, icon, items, activeItemId, onItemClick, isOpen, onToggle }) {
  return (
    <div className="dropdown">
      <DropdownHeader
        label={label}
        icon={icon}
        isOpen={isOpen}
        onToggle={onToggle}
      />
      <div className={`dropdown-items ${isOpen ? 'is-open' : ''}`}>
        <div className="dropdown-items-inner">
          {items.map((item) => (
            <DropdownItem
              key={item.id}
              id={item.id}
              label={item.label}
              isActive={activeItemId === item.id}
              onClick={onItemClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
