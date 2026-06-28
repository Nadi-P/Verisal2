import React from 'react';
import { useContentAreaLogic } from './ContentArea.logic.jsx';
import WelcomePage from '../../../pages/WelcomePage/WelcomePage.jsx';
import FxManagementPage from '../../../pages/FxManagementPage/FxManagementPage.jsx';
import AxiologyPage from '../../../pages/AxiologyPage/AxiologyPage.jsx';
import LoadingManagementPage from '../../../pages/LoadingManagementPage/LoadingManagementPage.jsx';
import HistoryPage from '../../../pages/HistoryPage/HistoryPage.jsx';
import ReportPage from '../../../pages/ReportPage/ReportPage.jsx';
import './ContentArea.css';

export default function ContentArea({ activePage, onNavigate }) {
  const { pageType, reportId } = useContentAreaLogic({ activePage });

  const renderPage = () => {
    switch (pageType) {
      case 'dashboard':
        return <WelcomePage onNavigate={onNavigate} />;
      case 'fx-management':
        return <FxManagementPage />;
      case 'loading-management':
        return <LoadingManagementPage />;
      case 'history':
        return <HistoryPage />;
      case 'axiology':
        return <AxiologyPage />;
      case 'report':
        return <ReportPage reportId={reportId} />;
      default:
        return <WelcomePage onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="content-area">
      <div className="content-area-inner" key={pageType || 'dashboard'}>
        {renderPage()}
      </div>
    </div>
  );
}
