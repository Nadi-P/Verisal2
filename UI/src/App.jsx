import React from 'react';
import './theme.css';
import './table-theme.css';
import './global.css';
import MainLayout from './components/layout/MainLayout/MainLayout.jsx';
import { UploadManagerProvider } from './contexts/UploadManagerContext.jsx';
import { TraceProvider }         from './contexts/TraceContext.jsx';

function App() {
  return (
    <UploadManagerProvider>
      <TraceProvider>
        <MainLayout />
      </TraceProvider>
    </UploadManagerProvider>
  );
}

export default App;
