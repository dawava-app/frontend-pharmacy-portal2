import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventorySummary,
  InventoryItemsQuery,
  InventoryItemsResponse,
  InventoryTransactionsQuery,
  InventoryTransactionsResponse,
  InventoryTransactionsStats,
  InventoryTransactionsStatsQuery,
  InventoryTransactionsExportQuery,
  DashboardAnalytics,
  DashboardAnalyticsQuery,
} from '../models/inventory.model';

/** Builds an HttpParams instance, skipping null/undefined/empty-string values
 *  so we never send e.g. `?search=` or `?status=` on the wire. */
function buildParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly CORE = environment.coreApiBase;
  private readonly base = `${this.CORE}/inventory/dashboard`;

  getSummary(branchId?: string): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.base}/summary`, {
      params: buildParams({ branchId }),
    });
  }

  getItems(query: InventoryItemsQuery): Observable<InventoryItemsResponse> {
    return this.http.get<InventoryItemsResponse>(`${this.base}/items`, {
      params: buildParams({ ...query }),
    });
  }

  getTransactions(query: InventoryTransactionsQuery): Observable<InventoryTransactionsResponse> {
    return this.http.get<InventoryTransactionsResponse>(`${this.base}/transactions`, {
      params: buildParams({ ...query }),
    });
  }

  getTransactionsStats(query: InventoryTransactionsStatsQuery): Observable<InventoryTransactionsStats> {
    return this.http.get<InventoryTransactionsStats>(`${this.base}/transactions/stats`, {
      params: buildParams({ ...query }),
    });
  }

  getAnalytics(query: DashboardAnalyticsQuery): Observable<DashboardAnalytics> {
    return this.http.get<DashboardAnalytics>(`${this.base}/analytics`, {
      params: buildParams({ ...query }),
    });
  }

  /** Downloads the transactions export as a file (CSV/XLSX from the API) and
   *  returns the raw Blob so the caller can trigger a browser download. */
  exportTransactions(query: InventoryTransactionsExportQuery): Observable<Blob> {
    return this.http.get(`${this.base}/transactions/export`, {
      params: buildParams({ ...query }),
      responseType: 'blob',
    });
  }
}
