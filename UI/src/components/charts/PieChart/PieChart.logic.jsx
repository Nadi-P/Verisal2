import { useMemo } from 'react';

/**
 * Builds an ECharts option object for a pie/donut chart.
 *
 * @param {Object} params
 * @param {Array<{ name: string, value: number }>} params.data - Pie slices
 * @param {string}    [params.title]      - Chart title
 * @param {boolean}   [params.donut]      - Render as donut (hollow center)
 * @param {boolean}   [params.showLegend] - Show legend
 * @param {string[]}  [params.colors]     - Custom slice colors
 */
export function usePieChartLogic({
  data = [],
  title = '',
  donut = false,
  showLegend = true,
  colors,
}) {
  const option = useMemo(() => ({
    title: title
      ? { text: title, left: 'center', textStyle: { color: '#e8e8e8', fontSize: 15, fontWeight: 500 } }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#2a2a2a',
      borderColor: '#3a3a3a',
      textStyle: { color: '#e8e8e8', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: showLegend
      ? {
          orient: 'horizontal',
          bottom: 0,
          textStyle: { color: '#a0a0a0', fontSize: 11 },
        }
      : undefined,
    color: colors || ['#90BEF0', '#6a9fd4', '#42a5f5', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc'],
    animationDuration: 900,
    animationEasing: 'cubicOut',
    series: [
      {
        type: 'pie',
        radius: donut ? ['45%', '70%'] : '70%',
        center: ['50%', showLegend ? '45%' : '50%'],
        data,
        label: {
          show: true,
          color: '#a0a0a0',
          fontSize: 11,
          formatter: '{b}',
        },
        labelLine: {
          lineStyle: { color: '#3a3a3a' },
        },
        itemStyle: {
          borderRadius: donut ? 6 : 4,
          borderColor: '#212121',
          borderWidth: 2,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(0, 0, 0, 0.4)',
          },
        },
      },
    ],
  }), [data, title, donut, showLegend, colors]);

  return { option };
}
