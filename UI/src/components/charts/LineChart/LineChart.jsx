import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useLineChartLogic } from './LineChart.logic.jsx';
import './LineChart.css';

export default function LineChart({
  categories,
  series,
  title,
  smooth,
  area,
  showLegend,
  colors,
  style,
}) {
  const { option } = useLineChartLogic({
    categories,
    series,
    title,
    smooth,
    area,
    showLegend,
    colors,
  });

  return (
    <div className="line-chart-wrapper" style={style}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}
