import React from 'react';
import { useLogoLogic } from './Logo.logic.jsx';
import './Logo.css';
import logo from '../../../assets/verisal-logo2.svg';

export default function Logo({ onClick }) {
  const { handleClick } = useLogoLogic({ onClick });

  return (
    <div className="logo-container" onClick={handleClick}>
      <img src={logo} alt="Verisal Logo" className="logo-icon" />
    </div>
  );
}
