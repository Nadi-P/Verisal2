import React from 'react';
import PagePlaceholder from '../../components/ui/PagePlaceholder/PagePlaceholder.jsx';
import { IconLoading } from '../../components/icons.jsx';
import './LoadingManagementPage.css';

export default function LoadingManagementPage() {
  return (
    <div className="loading-management-page">
      <PagePlaceholder
        icon={<IconLoading size={48} />}
        title="ניהול טעינה"
        subtitle="File upload status, error logs, and data quality indicators will appear here."
      />
    </div>
  );
}
