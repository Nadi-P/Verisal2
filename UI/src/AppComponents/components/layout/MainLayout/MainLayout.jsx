import React from 'react';
import { useMainLayoutLogic } from './MainLayout.logic.jsx';
import { useUploadManager } from '../../../contexts/UploadManagerContext.jsx';
import Sidebar from '../../sidebar/Sidebar/Sidebar.jsx';
import ContentArea from '../ContentArea/ContentArea.jsx';
import './MainLayout.css';

export default function MainLayout() {
  const { activePage, handleNavigate } = useMainLayoutLogic();
  const { isLoaded } = useUploadManager();

  // Sidebar appears ONLY after a folder has been successfully loaded.
  // The initial welcome screen and any error screens render solo.
  return (
    <div className={`main-layout ${isLoaded ? 'has-sidebar' : 'no-sidebar'}`}>
      {isLoaded && (
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      )}
      <ContentArea activePage={activePage} onNavigate={handleNavigate} />
    </div>
  );
}
