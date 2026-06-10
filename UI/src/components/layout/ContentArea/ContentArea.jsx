import React from 'react';
import { useContentAreaLogic } from './ContentArea.logic.jsx';
import DashboardPage from '../../../pages/DashboardPage/DashboardPage.jsx';
import CreateReportPage from '../../../pages/CreateReportPage/CreateReportPage.jsx';
import ConfigurationPage from '../../../pages/ConfigurationPage/ConfigurationPage.jsx';
import LoadingManagementPage from '../../../pages/LoadingManagementPage/LoadingManagementPage.jsx';
import ReportPage from '../../../pages/ReportPage/ReportPage.jsx';
import './ContentArea.css';

export default function ContentArea({ activePage }) {
  const { pageType, reportId } = useContentAreaLogic({ activePage });

  const renderPage = () => {
    switch (pageType) {
      case 'dashboard':
        return <DashboardPage />;
      case 'create-report':
        return <CreateReportPage />;
      case 'configuration':
        return <ConfigurationPage />;
      case 'loading-management':
        return <LoadingManagementPage />;
      case 'report':
        return <ReportPage reportId={reportId} />;
      default:
        return <DashboardPage />;
    }
  };

  // Important: key by `pageType` (not `activePage.id`) so that navigating
  // BETWEEN reports keeps the single `<ReportPage />` instance mounted —
  // only its `reportId` prop changes. The Report View screen is a
  // singleton; its top status bar (with metadata, mode toggle, sidebar
  // toggle) stays in place across report switches, and only the body
  // swaps. The data refetch is driven by ReportPage's effect on reportId.
  return (
    <div className="content-area">
      <div className="content-area-inner" key={pageType || 'dashboard'}>
        {renderPage()}
      </div>
    </div>
  );
}
