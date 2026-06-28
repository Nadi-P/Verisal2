import React from 'react';
import PagePlaceholder from '../../components/ui/PagePlaceholder/PagePlaceholder.jsx';
import { IconHistory } from '../../components/icons.jsx';
import './HistoryPage.css';

export default function HistoryPage() {
  return (
    <div className="history-page">
      <PagePlaceholder
        icon={<IconHistory size={48} />}
        title="היסטוריה"
        subtitle="טעינות, חישובים ופעולות אחרונות יוצגו כאן."
      />
    </div>
  );
}
