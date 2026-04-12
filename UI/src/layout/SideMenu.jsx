import React from 'react';
import { SideMenuDropdown } from './SideMenuDropdown.jsx';
import { ActionButton } from './SideMenuActionButton.jsx';
import { useSideMenu } from '../logic/SideMenuLogic.jsx';
import content from '../JSON/strings.json';
import paqaLogo from '../assets/verisal-logo2.svg';
import fileIcon from '../assets/icon-file-fill.png';
import templateIcon from '../assets/icon-template-fill.png';
import '../style/SideMenu.css';

function SideMenu({
  isOpen, onToggle, setTableData, setIsLoading, setMetadata, setColumns, setCheckupData,
  reportsLoaded, loadError, onLoadReports
}) {
  const {
    sharedSelectedItem,
    openDropdown,
    toggleDropdown,
    handleSelect,
  } = useSideMenu(setTableData, setIsLoading, setMetadata, setColumns, setCheckupData);

  return (
    <>
      {/* Toggle button always visible */}
      <button className="sidebar-toggle-btn" onClick={onToggle} title={isOpen ? 'סגור תפריט' : 'פתח תפריט'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {isOpen ? (
            <>
              <polyline points="9 18 15 12 9 6" />
            </>
          ) : (
            <>
              <polyline points="15 18 9 12 15 6" />
            </>
          )}
        </svg>
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-inner">
          <div className="logo">
            <img src={paqaLogo} alt="PAQA Logo" />
          </div>

          <div className="sidebar-all-dropdowns">
            <SideMenuDropdown
              title={content.sideMenuSourceReportDropdownHeader}
              icon={fileIcon}
              items={content.sideMenuSourceReportDropdownNames}
              globalSelected={sharedSelectedItem}
              onSelect={(itemData) => handleSelect(content.sideMenuSourceReportDropdownHeader, itemData)}
              isOpen={openDropdown === content.sideMenuSourceReportDropdownHeader}
              onToggle={() => toggleDropdown(content.sideMenuSourceReportDropdownHeader)}
              disabled={!reportsLoaded}
            />

            <SideMenuDropdown
              title={content.sideMenuTemplatesDropdownHeader}
              icon={templateIcon}
              items={content.templatesNames}
              globalSelected={sharedSelectedItem}
              onSelect={(itemData) => handleSelect(content.sideMenuTemplatesDropdownHeader, itemData)}
              isOpen={openDropdown === content.sideMenuTemplatesDropdownHeader}
              onToggle={() => toggleDropdown(content.sideMenuTemplatesDropdownHeader)}
              disabled={!reportsLoaded}
            />
          </div>

          <div className="sidebar-load-section">
            {loadError && (
              <div className="sidebar-load-error">{loadError}</div>
            )}
            <ActionButton
              style={{ marginBottom: '0.25rem', marginTop: 'auto' }}
              icon={null}
              label={content.loadReportsButtonTitle}
              onClick={onLoadReports}
              uploadButton
            />
          </div>
        </div>
      </aside>
    </>
  );
}

export default SideMenu;
