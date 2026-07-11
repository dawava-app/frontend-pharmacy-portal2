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

/** Start/end bounds (inclusive, day precision) for the last `days` days ending today.
 *  Always spans full calendar days — start at 00:00:00.000, end at 23:59:59.999 —
 *  so a 1-day window covers all of today instead of a zero-width instant. */
export function dailyRangeBounds(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/** Formats a Date using its LOCAL wall-clock components, with no UTC
 *  conversion — unlike Date.toISOString(), which converts to UTC first and
 *  silently shifts the calendar date back for any timezone ahead of UTC
 *  (e.g. local midnight in UTC+3 becomes 21:00 the previous day in UTC).
 *  Use this for any startDate/endDate sent to the backend, which itself
 *  returns naive (unsuffixed) datetime strings in local terms. */
export function toLocalIsoDateTime(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
