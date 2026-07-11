/** A single point on any time-series chart, fully decoupled from any backend DTO. */
export interface ChartPoint {
  /** ISO date string (day precision). */
  date: string;
  value: number;
}

export type TimeRangeKey = '7d' | '14d' | '30d' | '90d' | '1y';

export interface TimeRangeOption {
  key: TimeRangeKey;
  label: string;
  days: number;
}

/** Central definition of the ranges offered across the app's time-range selectors. */
export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: '7d',  label: 'Last 7 Days',   days: 7   },
  { key: '14d', label: 'Last 14 Days',  days: 14  },
  { key: '30d', label: 'Last 30 Days',  days: 30  },
  { key: '90d', label: 'Last 90 Days',  days: 90  },
  { key: '1y',  label: 'Last Year',     days: 365 },
];

export function timeRangeDays(key: TimeRangeKey): number {
  return TIME_RANGE_OPTIONS.find(o => o.key === key)?.days ?? 7;
}
