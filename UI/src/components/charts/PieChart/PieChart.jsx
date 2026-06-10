import React from 'react';
import ReactECharts from 'echarts-for-react';
import { usePieChartLogic } from './PieChart.logic.jsx';
import './PieChart.css';

export default function PieChart({
  data,
  title,
  donut,
  showLegend,
  colors,
  style,
}) {
  const { option } = usePieChartLogic({
    data,
    title,
    donut,
    showLegend,
    colors,
  });

  return (
    <div className="pie-chart-wrapper" style={style}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}
