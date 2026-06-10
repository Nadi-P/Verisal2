import { useMemo } from 'react';

/**
 * Builds an ECharts option object for a line chart.
 *
 * @param {Object} params
 * @param {string[]}  params.categories  - X-axis labels
 * @param {Array<{ name: string, values: number[] }>} params.series - Data series
 * @param {string}    [params.title]     - Chart title
 * @param {boolean}   [params.smooth]    - Smooth curves
 * @param {boolean}   [params.area]      - Fill area under lines
 * @param {boolean}   [params.showLegend] - Show legend
 * @param {string[]}  [params.colors]    - Custom series colors
 */
export function useLineChartLogic({
  categories = [],
  series = [],
  title = '',
  smooth = true,
  area = false,
  showLegend = true,
  colors,
}) {
  const option = useMemo(() => ({
    title: title
      ? { text: title, left: 'center', textStyle: { color: '#e8e8e8', fontSize: 15, fontWeight: 500 } }
      : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2a2a2a',
      borderColor: '#3a3a3a',
      textStyle: { color: '#e8e8e8', fontSize: 12 },
    },
    legend: showLegend && series.length > 1
      ? { top: title ? 30 : 0, textStyle: { color: '#a0a0a0', fontSize: 11 } }
      : undefined,
    grid: {
      top: title ? 60 : 30,
      right: 16,
      bottom: 24,
      left: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#a0a0a0', fontSize: 11 },
      axisLine: { lineStyle: { color: '#3a3a3a' } },
      axisTick: { show: false },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#666', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2e2e2e' } },
    },
    color: colors || ['#90BEF0', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc'],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.values,
      smooth,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      areaStyle: area ? { opacity: 0.12 } : undefined,
      emphasis: { focus: 'series' },
    })),
  }), [categories, series, title, smooth, area, showLegend, colors]);

  return { option };
}
