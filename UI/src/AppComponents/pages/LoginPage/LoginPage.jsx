import React from 'react';
import { useLoginLogic } from './LoginPage.logic.jsx';
import verisalLogo from '../../../assets/logo-with-text.svg';
import './LoginPage.css';

// Destructure onLoginSuccess from props
function LoginPage({ onLoginSuccess }) {
  const {
    credentials,
    error,
    isFading,
    isButtonDisabled,
    handleChange,
    handleLogin
  } = useLoginLogic(onLoginSuccess); // Passing it into the hook

  return (
    <div className={`login-container ${isFading ? 'fade-out' : ''}`} dir="rtl">
      <div className="login-card">
        <img src={verisalLogo} alt="Verisal Logo" className="login-logo" />

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>שם משתמש</label>
            <input
              type="text"
              name="username"
              className="login-input"
              value={credentials.username}
              onChange={handleChange}
              placeholder="הזן שם משתמש"
            />
          </div>

          <div className="input-group">
            <label>סיסמה</label>
            <input
              type="password"
              name="password"
              className="login-input"
              value={credentials.password}
              onChange={handleChange}
              placeholder="הזן סיסמה"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isButtonDisabled}
          >
            התחבר למערכת
          </button>

          {error && <div className="login-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
