import React from 'react';
import { useSidebarLogic, PAGE_IDS, DROPDOWN_IDS } from './Sidebar.logic.jsx';
import { useUploadManager } from '../../../contexts/UploadManagerContext.jsx';
import Logo from '../../ui/Logo/Logo.jsx';
import Dropdown from '../../ui/Dropdown/Dropdown.jsx';
import SidebarButton from '../../ui/SidebarButton/SidebarButton.jsx';
import SectionDivider from '../../ui/SectionDivider/SectionDivider.jsx';
import {
  IconReports,
  IconManufactured,
  IconLoading,
  IconFxManagement,
  IconHistory,
  IconUpload,
  IconCollapse,
  IconExpand,
} from '../../icons.jsx';
import './Sidebar.css';

export default function Sidebar({ activePage, onNavigate }) {
  const {
    collapsed,
    toggleCollapse,
    systemReports,
    manufacturedReports,
    openDropdownId,
    toggleDropdown,
    handleReportClick,
    handlePageClick,
    handleLogoClick,
    handleUploadClick,
    handleFilesSelected,
    fileInputRef,
  } = useSidebarLogic({ activePage, onNavigate });
  const { uploadState, stopUpload, payload } = useUploadManager();

  const activeId = activePage?.id;

  // A report-backed loading item is disabled once a payload exists and the
  // backing report is missing or flagged disabled (missing file / dep).
  const hasPayload = !!(payload && payload.reports);
  const reportDisabled = (id) => {
    if (!hasPayload) return false;
    const r = payload.reports[id];
    return !r || !!r.disabled;
  };
  const isBusy =
    uploadState && (uploadState.kind === 'loading' || uploadState.kind === 'stopping');
  const isCanceling = uploadState && uploadState.kind === 'stopping';

  return (
    <nav className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      {/* ---- Collapse / Expand toggle ---- */}
      <button className="sidebar-toggle-btn" onClick={toggleCollapse}>
        {collapsed ? <IconExpand size={16} /> : <IconCollapse size={16} />}
      </button>

      {/* ---- All sidebar content fades in/out ---- */}
      <div className="sidebar-content">
        {/* ---- Logo ---- */}
        <Logo onClick={handleLogoClick} />

        <SectionDivider />

        {/* ---- System Reports (accordion) ---- */}
        <div className="sidebar-section">
          <Dropdown
            label="דוחות מערכת"
            icon={<IconReports size={18} />}
            items={systemReports}
            activeItemId={activeId}
            onItemClick={handleReportClick}
            isOpen={openDropdownId === DROPDOWN_IDS.SYSTEM}
            onToggle={() => toggleDropdown(DROPDOWN_IDS.SYSTEM)}
          />
        </div>

        {/* ---- Manufactured Reports (accordion) ---- */}
        <div className="sidebar-section">
          <Dropdown
            label="דוחות מיוצרים"
            icon={<IconManufactured size={18} />}
            items={manufacturedReports}
            activeItemId={activeId}
            onItemClick={handleReportClick}
            isOpen={openDropdownId === DROPDOWN_IDS.MANUFACTURED}
            onToggle={() => toggleDropdown(DROPDOWN_IDS.MANUFACTURED)}
          />
        </div>

        {/* ---- Loading Table dropdown (2 reports + axiology page) ---- */}
        <div className="sidebar-section">
          <Dropdown
            label="ניהול טעינה"
            icon={<IconLoading size={18} />}
            items={[
              { id: PAGE_IDS.LOADING_TABLE,     label: 'טבלת טעינה',            disabled: reportDisabled(PAGE_IDS.LOADING_TABLE) },
              { id: PAGE_IDS.LOADING_VS_CENTER, label: 'טבלת טעינה מול מרכז שכר', disabled: reportDisabled(PAGE_IDS.LOADING_VS_CENTER) },
              { id: PAGE_IDS.AXIOLOGY,          label: 'אקסיולוגיה' },
            ]}
            activeItemId={activeId}
            onItemClick={(id) => {
              // Axiology is a PAGE; the other two are manufactured REPORTS.
              if (id === PAGE_IDS.AXIOLOGY) handlePageClick(id);
              else                          handleReportClick(id);
            }}
            isOpen={openDropdownId === DROPDOWN_IDS.LOADING}
            onToggle={() => toggleDropdown(DROPDOWN_IDS.LOADING)}
          />
        </div>

        <SectionDivider />

        {/* ---- Action Buttons ---- */}
        <div className="sidebar-section">
          <SidebarButton
            id={PAGE_IDS.LOADING_MANAGEMENT}
            label="ניהול העלאות"
            icon={<IconLoading size={18} />}
            isActive={activeId === PAGE_IDS.LOADING_MANAGEMENT}
            onClick={handlePageClick}
          />
          <SidebarButton
            id={PAGE_IDS.FX_MANAGEMENT}
            label='ניהול שערי מט"ח'
            icon={<IconFxManagement size={18} />}
            isActive={activeId === PAGE_IDS.FX_MANAGEMENT}
            onClick={handlePageClick}
          />
          <SidebarButton
            id={PAGE_IDS.HISTORY}
            label="היסטוריה"
            icon={<IconHistory size={18} />}
            isActive={activeId === PAGE_IDS.HISTORY}
            onClick={handlePageClick}
            disabled
          />
        </div>

        {/* ---- Spacer pushes upload to bottom ---- */}
        <div className="sidebar-spacer" />

        {/* ---- Upload / Cancel (pinned bottom) ---- */}
        {isBusy ? (
          <button
            className="sidebar-upload-button sidebar-upload-button-cancel"
            onClick={stopUpload}
            disabled={isCanceling}
          >
            <span className="sidebar-upload-button-icon">
              <span className="sidebar-upload-spinner" aria-hidden="true" />
            </span>
            {isCanceling ? 'מבטל...' : 'בטל טעינה'}
          </button>
        ) : (
          <button className="sidebar-upload-button" onClick={handleUploadClick}>
            <span className="sidebar-upload-button-icon">
              <IconUpload size={18} />
            </span>
            העלאת קבצים
          </button>
        )}
        <input
          ref={fileInputRef}
          className="sidebar-upload-input"
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFilesSelected}
        />
      </div>
    </nav>
  );
}
