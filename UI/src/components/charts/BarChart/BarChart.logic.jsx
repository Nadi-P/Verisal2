import { useMemo } from 'react';

/**
 * Builds an ECharts option object for a bar chart.
 *
 * @param {Object} params
 * @param {string[]}  params.categories  - X-axis labels (e.g. month names)
 * @param {Array<{ name: string, values: number[] }>} params.series - One or more data series
 * @param {string}    [params.title]     - Chart title
 * @param {boolean}   [params.horizontal] - Flip axes for horizontal bars
 * @param {boolean}   [params.stacked]   - Stack series on top of each other
 * @param {boolean}   [params.showLegend] - Show legend
 * @param {string[]}  [params.colors]    - Custom series colors
 */
export function useBarChartLogic({
  categories = [],
  series = [],
  title = '',
  horizontal = false,
  stacked = false,
  showLegend = true,
  colors,
}) {
  const option = useMemo(() => {
    const categoryAxis = {
      type: 'category',
      data: categories,
      axisLabel: { color: '#a0a0a0', fontSize: 11 },
      axisLine: { lineStyle: { color: '#3a3a3a' } },
      axisTick: { show: false },
    };

    const valueAxis = {
      type: 'value',
      axisLabel: { color: '#666', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2e2e2e' } },
    };

    return {
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
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      color: colors || ['#90BEF0', '#6a9fd4', '#42a5f5', '#66bb6a', '#ffa726'],
      animationDuration: 800,
      animationEasing: 'cubicOut',
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.values,
        stack: stacked ? 'total' : undefined,
        barMaxWidth: 40,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
      })),
    };
  }, [categories, series, title, horizontal, stacked, showLegend, colors]);

  return { option };
}
