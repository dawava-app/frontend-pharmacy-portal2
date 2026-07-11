/**
 * Models for the /inventory/dashboard/* endpoints.
 * Source: https://api.dawava.me/core/swagger/index.html#/Inventory
 */

/* ---------- Stock status ---------- */

/** Numeric status code sent/received on the wire.
 *  NOTE: adjust these numbers if the backend enum differs — swagger only
 *  exposes them as a plain int32, so the mapping below is inferred from the
 *  string values ("Available" / "Limited" / "Out of Stock" / "Unknown")
 *  returned by the API. Update in this single spot if needed. */
export enum StockStatus {
  Unknown = 0,
  Available = 1,
  Limited = 2,
  OutOfStock = 3,
}

export const STOCK_STATUS_LABEL: Record<number, string> = {
  [StockStatus.Unknown]: 'Unknown',
  [StockStatus.Available]: 'Available',
  [StockStatus.Limited]: 'Limited',
  [StockStatus.OutOfStock]: 'Out of Stock',
};

/** Maps the *string* status some endpoints return (e.g. "Available") back
 *  to a CSS-friendly badge modifier class. */
export function statusBadgeClass(status: string | number | null | undefined): string {
  const s = String(status ?? '').toLowerCase().replace(/\s+/g, '-');
  if (s.includes('available')) return 'available';
  if (s.includes('limited')) return 'limited';
  if (s.includes('out')) return 'out-of-stock';
  return 'unknown';
}

/* ---------- /inventory/dashboard/summary ---------- */

export interface InventorySummary {
  totalSkus: number;
  availableCount: number;
  limitedCount: number;
  outOfStockCount: number;
  unknownCount: number;
  totalValue: number;
  currencyCode: string;
  lastSyncedAt: string;
  transactionsTodayCount: number;
  addedQuantityToday: number;
  reducedQuantityToday: number;
  valueChangeToday: number;
}

/* ---------- /inventory/dashboard/items ---------- */

export interface InventoryItem {
  variantId: string;
  medicineName: string;
  variantName: string;
  barcode: string;
  quantity: number;
  status: string;
  source: string;
  price: number;
  currencyCode: string;
  lastUpdatedAt: string;
  updatedByUser: string | null;
}

export interface InventoryItemsResponse {
  items: InventoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InventoryItemsQuery {
  branchId?: string;
  status?: number;
  search?: string;
  excludeOutOfStock?: boolean;
  page?: number;
  pageSize?: number;
}

/* ---------- /inventory/dashboard/transactions ---------- */

export interface InventoryTransaction {
  id: string;
  branchId: string;
  variantId: string;
  medicineName: string;
  variantName: string;
  barcode: string;
  quantity: number;
  delta: number;
  source: string;
  statusBefore: string;
  statusAfter: string;
  changedByUser: string | null;
  stockSyncEventId: string;
  occurredAt: string;
  recordedAt: string;
  unitPrice: number;
  totalAmount: number;
  currencyCode: string;
}

export interface InventoryTransactionsResponse {
  items: InventoryTransaction[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface InventoryTransactionsQuery {
  branchId?: string;
  variantId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/* ---------- /inventory/dashboard/transactions/stats ---------- */

export interface SourceBreakdown {
  source: string;
  count: number;
  netDelta: number;
}

export interface DailyTimelinePoint {
  date: string;
  count: number;
  addedQuantity: number;
  reducedQuantity: number;
}

export interface TopActiveVariant {
  variantId: string;
  medicineName: string;
  variantName: string;
  barcode: string;
  count: number;
  netDelta: number;
}

export interface StatusTransition {
  statusBefore: string;
  statusAfter: string;
  count: number;
}

export interface InventoryTransactionsStats {
  totalTransactions: number;
  totalAdditions: number;
  totalReductions: number;
  totalAddedQuantity: number;
  totalReducedQuantity: number;
  netFinancialValue: number;
  stockoutCount: number;
  sourceBreakdown: SourceBreakdown[];
  dailyTimeline: DailyTimelinePoint[];
  topActiveVariants: TopActiveVariant[];
  statusTransitions: StatusTransition[];
}

export interface InventoryTransactionsStatsQuery {
  branchId?: string;
  variantId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}

/* ---------- /inventory/dashboard/analytics ---------- */

export interface AnalyticsMetric {
  currentValue: number;
  comparisonValue: number;
  changePercentage: number;
}

export interface DashboardAnalyticsSummary {
  revenue: AnalyticsMetric;
  salesCount: AnalyticsMetric;
  averageTransactionValue: AnalyticsMetric;
}

export interface StockTimelinePoint {
  date: string;
  totalQuantity: number;
  totalValue: number;
  uniqueSkus: number;
}

export interface SalesTimelinePoint {
  date: string;
  revenue: number;
  transactionCount: number;
  comparisonRevenue: number;
  comparisonTransactionCount: number;
}

export interface DashboardAnalytics {
  summary: DashboardAnalyticsSummary;
  stockTimeline: StockTimelinePoint[];
  salesTimeline: SalesTimelinePoint[];
  currency: string;
}

export interface DashboardAnalyticsQuery {
  branchId: string;
  startDate: string;
  endDate: string;
}

/* ---------- /inventory/dashboard/transactions/export ---------- */

export interface InventoryTransactionsExportQuery {
  branchId?: string;
  variantId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
