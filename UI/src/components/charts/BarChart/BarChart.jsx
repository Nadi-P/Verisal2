import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useBarChartLogic } from './BarChart.logic.jsx';
import './BarChart.css';

export default function BarChart({
  categories,
  series,
  title,
  horizontal,
  stacked,
  showLegend,
  colors,
  style,
}) {
  const { option } = useBarChartLogic({
    categories,
    series,
    title,
    horizontal,
    stacked,
    showLegend,
    colors,
  });

  return (
    <div className="bar-chart-wrapper" style={style}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}
