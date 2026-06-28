import React, { useState } from 'react';
import './theme.css';
import MainLayout from './components/layout/MainLayout/MainLayout.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import { UploadManagerProvider } from './contexts/UploadManagerContext.jsx';
import { TraceProvider }         from './contexts/TraceContext.jsx';

function App() {
  // The login screen is the first thing the user sees. Only after a
  // successful login do we mount the app (and its data providers), so
  // nothing fetches or initializes behind the login gate.
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <LoginPage onLoginSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <UploadManagerProvider>
      <TraceProvider>
        <MainLayout />
      </TraceProvider>
    </UploadManagerProvider>
  );
}

export default App;
