import { ChartPoint } from '../models/chart.model';

function dateKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}

/**
 * Fills every calendar day between start and end (inclusive) with a point,
 * using 0 for any day missing from the input — so charts always render a
 * complete, evenly-spaced timeline instead of stretching sparse points.
 * Generic over ChartPoint only: callers adapt their own DTO to ChartPoint
 * before calling this, keeping the chart layer independent of backend shape.
 */
export function zeroFillDailyRange(points: ChartPoint[], start: Date, end: Date): ChartPoint[] {
  const byDate = new Map(points.map(p => [dateKey(p.date), p.value]));

  const result: ChartPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endBoundary = new Date(end);
  endBoundary.setHours(0, 0, 0, 0);

  while (cursor <= endBoundary) {
    result.push({
      date: cursor.toISOString(),
      value: byDate.get(dateKey(cursor)) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/** Start/end bounds (inclusive, day precision) for the last `days` days ending today. */
export function dailyRangeBounds(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}
