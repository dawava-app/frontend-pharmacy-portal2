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

function baseTooltip(theme: Theme, valueLabel: string): ApexTooltip {
  return {
    theme: theme.tooltipTheme,
    x: { format: 'dd MMM yyyy' },
    y: { formatter: (val: number) => `${val.toLocaleString()} ${valueLabel}` },
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

/** Stock Trends: net daily stock change — can be positive or negative, so it
 *  gets a zero-reference baseline. Single teal series, area-filled line. */
export function buildLineChartOptions(points: ChartPoint[], isDark: boolean): ApexBundle {
  const theme = resolveTheme(isDark);
  const data = points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }));
  const markerSize = points.length > 60 ? 0 : 4;

  return {
    series: [{ name: 'Net Stock Change', data }],
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
    tooltip: baseTooltip(theme, 'units'),
    dataLabels: { enabled: false },
    colors: [theme.teal],
    annotations: {
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
    },
    noData: baseNoData(theme),
    plotOptions: {},
  };
}

/** Transaction Volume: daily transaction counts — never negative, so no
 *  zero-baseline annotation is needed. Single teal series, rounded columns. */
export function buildBarChartOptions(points: ChartPoint[], isDark: boolean): ApexBundle {
  const theme = resolveTheme(isDark);
  const data = points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }));

  return {
    series: [{ name: 'Transactions', data }],
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
    tooltip: baseTooltip(theme, 'transactions'),
    dataLabels: { enabled: false },
    colors: [theme.teal],
    annotations: {},
    noData: baseNoData(theme),
    plotOptions: {
      bar: { columnWidth: '55%', borderRadius: 4, borderRadiusApplication: 'end' },
    },
  };
}
