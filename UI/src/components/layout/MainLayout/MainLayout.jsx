import React from 'react';
import { useMainLayoutLogic } from './MainLayout.logic.jsx';
import Sidebar from '../../sidebar/Sidebar/Sidebar.jsx';
import ContentArea from '../ContentArea/ContentArea.jsx';
import './MainLayout.css';

export default function MainLayout() {
  const { activePage, handleNavigate } = useMainLayoutLogic();

  return (
    <div className="main-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      <ContentArea activePage={activePage} />
    </div>
  );
}
