import React from 'react';
import PagePlaceholder from '../../components/ui/PagePlaceholder/PagePlaceholder.jsx';
import { IconDashboard } from '../../components/icons.jsx';
import './DashboardPage.css';

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <PagePlaceholder
        icon={<IconDashboard size={48} />}
        title="Dashboard"
        subtitle="KPI cards, charts, and summary tables will appear here."
      />
    </div>
  );
}
