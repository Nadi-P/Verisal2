import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './Login';
import Dashboard from './Dashboard';

function App() {
  // In-memory state: resets when the app process ends
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ?
            <Navigate to="/" /> :
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ?
            <Dashboard /> :
            <Navigate to="/login" />
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;