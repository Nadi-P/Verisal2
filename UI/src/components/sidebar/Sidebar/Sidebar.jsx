import React from 'react';
import { useSidebarLogic, PAGE_IDS, DROPDOWN_IDS } from './Sidebar.logic.jsx';
import Logo from '../../ui/Logo/Logo.jsx';
import Dropdown from '../../ui/Dropdown/Dropdown.jsx';
import SidebarButton from '../../ui/SidebarButton/SidebarButton.jsx';
import SectionDivider from '../../ui/SectionDivider/SectionDivider.jsx';
import {
  IconReports,
  IconManufactured,
  IconCreateReport,
  IconLoading,
  IconConfig,
  IconAnomalies,
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
    uploadStatus,
  } = useSidebarLogic({ activePage, onNavigate });

  const activeId = activePage?.id;

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

        <SectionDivider />

        {/* ---- Action Buttons ---- */}
        <div className="sidebar-section">
          <SidebarButton
            id={PAGE_IDS.CREATE_REPORT}
            label="יצירת דוח חדש"
            icon={<IconCreateReport size={18} />}
            isActive={activeId === PAGE_IDS.CREATE_REPORT}
            onClick={handlePageClick}
          />
          <SidebarButton
            id={PAGE_IDS.ANOMALIES}
            label="ניהול חריגות"
            icon={<IconAnomalies size={18} />}
            isActive={activeId === PAGE_IDS.ANOMALIES}
            onClick={handlePageClick}
          />
          <SidebarButton
            id={PAGE_IDS.LOADING_MANAGEMENT}
            label="ניהול טעינה"
            icon={<IconLoading size={18} />}
            isActive={activeId === PAGE_IDS.LOADING_MANAGEMENT}
            onClick={handlePageClick}
          />
          <SidebarButton
            id={PAGE_IDS.CONFIGURATION}
            label="הגדרות"
            icon={<IconConfig size={18} />}
            isActive={activeId === PAGE_IDS.CONFIGURATION}
            onClick={handlePageClick}
          />
        </div>

        {/* ---- Spacer pushes upload to bottom ---- */}
        <div className="sidebar-spacer" />

        {/* ---- Upload Files (pinned bottom) ---- */}
        <button className="sidebar-upload-button" onClick={handleUploadClick}>
          <span className="sidebar-upload-button-icon">
            <IconUpload size={18} />
          </span>
          העלאת קבצים
        </button>
        {uploadStatus && (
          <div className={`sidebar-upload-status sidebar-upload-status-${uploadStatus.type}`}>
            {uploadStatus.message}
          </div>
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
