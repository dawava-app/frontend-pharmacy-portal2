import {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexMarkers,
  ApexNoData,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { ChartPoint } from '../../models/chart.model';

export interface ApexBundle {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  markers: ApexMarkers;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  colors: string[];
  annotations: ApexAnnotations;
  noData: ApexNoData;
  plotOptions: ApexPlotOptions;
}

interface Theme {
  teal: string;
  tealSoft: string;
  gridColor: string;
  textColor: string;
  tooltipTheme: 'light' | 'dark';
}

export interface ChartSeriesConfig {
  seriesName: string;
  /** Formats a raw value for the tooltip, e.g. "1,234 units" or "SAR 1,234". */
  valueFormatter: (val: number) => string;
  /** Only meaningful for the line chart — draws a y=0 reference line. Only
   *  set this when the series can genuinely go negative; a metric that's
   *  always >= 0 (levels, counts, money) doesn't need one. */
  showZeroBaseline?: boolean;
}

/** Mirrors the exact hex values in styles.scss so the charts always match the
 *  app's single teal theme in both light and dark mode. */
function resolveTheme(isDark: boolean): Theme {
  return isDark
    ? { teal: '#38aca1', tealSoft: 'rgba(56,172,161,0.35)', gridColor: 'rgba(148,163,184,0.14)', textColor: '#94a3b8', tooltipTheme: 'dark' }
    : { teal: '#14b8a5', tealSoft: 'rgba(20,184,165,0.25)', gridColor: '#d4dbe4', textColor: '#64748b', tooltipTheme: 'light' };
}

function baseXAxis(theme: Theme): ApexXAxis {
  return {
    type: 'datetime',
    labels: {
      style: { colors: theme.textColor, fontSize: '10px', fontWeight: 600 },
      datetimeFormatter: { day: 'dd MMM' },
      // ApexCharts defaults to formatting datetime axes in UTC. Our points
      // are local-midnight timestamps, so with the default (true) a point
      // meant to represent "11 Jul locally" (= 10 Jul 21:00 UTC in UTC+3)
      // gets labeled "10 Jul" instead. Force local-timezone formatting.
      datetimeUTC: false,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };
}

function baseYAxis(theme: Theme): ApexYAxis {
  return {
    labels: {
      style: { colors: theme.textColor, fontSize: '10px', fontWeight: 600 },
    },
  };
}

function baseGrid(theme: Theme): ApexGrid {
  return {
    borderColor: theme.gridColor,
    strokeDashArray: 0,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { top: 0, right: 8, bottom: 0, left: 8 },
  };
}

function baseTooltip(theme: Theme, valueFormatter: (val: number) => string): ApexTooltip {
  return {
    theme: theme.tooltipTheme,
    x: { format: 'dd MMM yyyy' },
    y: { formatter: valueFormatter },
  };
}

function baseNoData(theme: Theme): ApexNoData {
  return {
    text: 'No data for this period',
    align: 'center',
    verticalAlign: 'middle',
    style: { color: theme.textColor, fontSize: '13px' },
  };
}

/** Area-filled line chart, single teal series. Pass showZeroBaseline: true
 *  only for series that can go negative (e.g. a net change/delta metric). */
export function buildLineChartOptions(points: ChartPoint[], isDark: boolean, config: ChartSeriesConfig): ApexBundle {
  const theme = resolveTheme(isDark);
  const data = points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }));
  const markerSize = points.length > 60 ? 0 : 4;

  return {
    series: [{ name: config.seriesName, data }],
    chart: {
      type: 'area',
      height: 160,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400, dynamicAnimation: { enabled: true, speed: 300 } },
      fontFamily: 'Inter, sans-serif',
    },
    xaxis: baseXAxis(theme),
    yaxis: baseYAxis(theme),
    stroke: { curve: 'smooth', width: 2.5 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] },
    },
    markers: { size: markerSize, strokeWidth: 0, hover: { size: 7 } },
    grid: baseGrid(theme),
    tooltip: baseTooltip(theme, config.valueFormatter),
    dataLabels: { enabled: false },
    colors: [theme.teal],
    annotations: config.showZeroBaseline ? {
      yaxis: [{
        y: 0,
        borderColor: theme.gridColor,
        strokeDashArray: 0,
        label: {
          text: '0',
          borderColor: 'transparent',
          style: { color: theme.textColor, background: 'transparent', fontSize: '10px' },
        },
      }],
    } : {},
    noData: baseNoData(theme),
    plotOptions: {},
  };
}

/** Rounded-column bar chart, single teal series. */
export function buildBarChartOptions(points: ChartPoint[], isDark: boolean, config: ChartSeriesConfig): ApexBundle {
  const theme = resolveTheme(isDark);
  const data = points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }));

  return {
    series: [{ name: config.seriesName, data }],
    chart: {
      type: 'bar',
      height: 160,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400, dynamicAnimation: { enabled: true, speed: 300 } },
      fontFamily: 'Inter, sans-serif',
    },
    xaxis: baseXAxis(theme),
    yaxis: baseYAxis(theme),
    stroke: { show: false },
    fill: { type: 'solid', opacity: 1 },
    markers: {},
    grid: baseGrid(theme),
    tooltip: baseTooltip(theme, config.valueFormatter),
    dataLabels: { enabled: false },
    colors: [theme.teal],
    annotations: {},
    noData: baseNoData(theme),
    plotOptions: {
      bar: { columnWidth: '55%', borderRadius: 4, borderRadiusApplication: 'end' },
    },
  };
}
