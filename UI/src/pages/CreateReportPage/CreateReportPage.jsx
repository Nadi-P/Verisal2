import React from 'react';
import PagePlaceholder from '../../components/ui/PagePlaceholder/PagePlaceholder.jsx';
import { IconCreateReport } from '../../components/icons.jsx';
import './CreateReportPage.css';

export default function CreateReportPage() {
  return (
    <div className="create-report-page">
      <PagePlaceholder
        icon={<IconCreateReport size={48} />}
        title="יצירת דוח חדש"
        subtitle="Report builder with filter, aggregate, and join operations will appear here."
      />
    </div>
  );
}
