import React from 'react';

function SideMenuDropdownItem({ data, isActive, onClick }) {
  return (
    <div
      className={`dropdown-item ${isActive ? 'active' : ''}`}
      onClick={() => onClick(data)}
    >
      {data.display_title}
    </div>
  );
}

function SideMenuDropdown({ title, icon, items, globalSelected, onSelect, isOpen, onToggle }) {
  return (
    <div className="custom-dropdown-container">
      <div className="dropdown-header" onClick={onToggle}>
        {icon && <img alt="" src={icon} className="sidebar-button-icon" />}
        {title}
        <span className={`arrow ${isOpen ? 'up' : 'down'}`}>▾</span>
      </div>
      <div className={`dropdown-menu tree-branch ${isOpen ? 'expanded' : ''}`}>
        {isOpen && Object.values(items).map((itemData, i) => (
          <SideMenuDropdownItem
            key={itemData.file_name}
            data={itemData}
            isActive={globalSelected?.item === itemData.file_name}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export { SideMenuDropdown };
