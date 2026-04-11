import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './Login';
import Dashboard from './Dashboard';

function App() {
  // In-memory state: resets when the app process ends
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;