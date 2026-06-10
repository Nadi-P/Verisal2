import React from 'react';
import { useKPICardLogic } from './KPICard.logic.jsx';
import './KPICard.css';

export default function KPICard({
  label,
  value,
  format,
  change,
  changeLabel,
  icon,
  style,
}) {
  const { formattedValue, changeInfo } = useKPICardLogic({ value, format, change });

  return (
    <div className="kpi-card" style={style}>
      <div className="kpi-card-header">
        <span className="kpi-card-label">{label}</span>
        {icon && <span className="kpi-card-icon">{icon}</span>}
      </div>
      <span className="kpi-card-value">{formattedValue}</span>
      {changeInfo && (
        <div className="kpi-card-footer">
          <span className={`kpi-card-change ${changeInfo.direction}`}>
            {changeInfo.direction === 'up' && '↑'}
            {changeInfo.direction === 'down' && '↓'}
            {changeInfo.label}
          </span>
          {changeLabel && <span className="kpi-card-change-label">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
