import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap, catchError, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { InventoryService } from '../../../../shared/services/inventory.service';
import { UserProfileService } from '../../../../shared/services/user-profile.service';
import {
  InventorySummary,
  InventoryItem,
  StockStatus,
  STOCK_STATUS_LABEL,
  statusBadgeClass,
} from '../../../../shared/models/inventory.model';
import { exportInventoryPdf, exportInventoryExcel } from '../../../../shared/utils/inventory-export.util';

/** Items are exported using the current filters but ignoring pagination, so
 *  the report always reflects everything the filters match. Backend is asked
 *  for a single large page rather than looping — bump this if a pharmacy's
 *  catalog ever exceeds it. */
const EXPORT_PAGE_SIZE = 5000;

const STATUS_OPTIONS: { value: number | ''; label: string }[] = [
  { value: '', label: 'All Availability Status' },
  { value: StockStatus.Available, label: STOCK_STATUS_LABEL[StockStatus.Available] },
  { value: StockStatus.Limited, label: STOCK_STATUS_LABEL[StockStatus.Limited] },
  { value: StockStatus.OutOfStock, label: STOCK_STATUS_LABEL[StockStatus.OutOfStock] },
  { value: StockStatus.Unknown, label: STOCK_STATUS_LABEL[StockStatus.Unknown] },
];

@Component({
  selector: 'app-inventory-stock-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-tab.component.html',
  styleUrl: './stock-tab.component.scss',
})
export class StockTabComponent {
  private readonly auth   = inject(AuthService);
  private readonly inventorySvc = inject(InventoryService);
  private readonly userProfileSvc = inject(UserProfileService);

  readonly statusOptions = STATUS_OPTIONS;
  readonly statusBadgeClass = statusBadgeClass;

  showExportMenu = signal(false);
  exporting      = signal<'pdf' | 'excel' | null>(null);

  summary       = signal<InventorySummary | null>(null);
  summaryLoading = signal(true);

  items         = signal<InventoryItem[]>([]);
  itemsLoading  = signal(true);
  error         = signal('');

  search            = signal('');
  status            = signal<number | ''>('');
  excludeOutOfStock = signal(false);
  page              = signal(1);
  pageSize          = 20;
  totalCount        = signal(0);
  totalPages        = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  private readonly search$ = new Subject<string>();

  constructor() {
    // Reload summary + items whenever the active branch changes.
    effect(() => {
      const branchId = this.auth.currentBranchId();
      if (!branchId) return;
      this.loadSummary(branchId);
      this.page.set(1);
      this.loadItems(branchId);
    });

    // Debounce free-text search input before hitting the API.
    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      tap(value => { this.search.set(value); this.page.set(1); }),
      switchMap(() => {
        const branchId = this.auth.currentBranchId();
        return branchId ? this.fetchItems(branchId) : of(null);
      }),
    ).subscribe();
  }

  private loadSummary(branchId: string): void {
    this.summaryLoading.set(true);
    this.inventorySvc.getSummary(branchId).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.summary.set(res);
      this.summaryLoading.set(false);
    });
  }

  private fetchItems(branchId: string) {
    this.itemsLoading.set(true);
    this.error.set('');
    return this.inventorySvc.getItems({
      branchId,
      status: this.status() === '' ? undefined : Number(this.status()),
      search: this.search() || undefined,
      excludeOutOfStock: this.excludeOutOfStock() || undefined,
      page: this.page(),
      pageSize: this.pageSize,
    }).pipe(
      tap(res => {
        this.items.set(res.items ?? []);
        this.totalCount.set(res.totalCount ?? 0);
        this.itemsLoading.set(false);
      }),
      catchError(() => {
        this.items.set([]);
        this.totalCount.set(0);
        this.itemsLoading.set(false);
        this.error.set('Failed to load inventory items. Please try again.');
        return of(null);
      }),
    );
  }

  loadItems(branchId: string): void {
    this.fetchItems(branchId).subscribe();
  }

  onSearchInput(value: string): void {
    this.search$.next(value);
  }

  onStatusChange(value: string): void {
    this.status.set(value === '' ? '' : Number(value));
    this.page.set(1);
    this.reload();
  }

  onExcludeOutOfStockChange(checked: boolean): void {
    this.excludeOutOfStock.set(checked);
    this.page.set(1);
    this.reload();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.reload();
  }

  refresh(): void {
    const branchId = this.auth.currentBranchId();
    if (!branchId) return;
    this.loadSummary(branchId);
    this.loadItems(branchId);
  }

  private reload(): void {
    const branchId = this.auth.currentBranchId();
    if (branchId) this.loadItems(branchId);
  }

  trackByVariant(_: number, item: InventoryItem): string { return item.variantId; }

  toggleExportMenu(): void {
    this.showExportMenu.set(!this.showExportMenu());
  }

  private currentFiltersSummary(): string {
    const parts: string[] = [];
    const statusLabel = this.status() === '' ? null : STOCK_STATUS_LABEL[Number(this.status())];
    if (statusLabel) parts.push(`Status: ${statusLabel}`);
    if (this.search()) parts.push(`Search: "${this.search()}"`);
    if (this.excludeOutOfStock()) parts.push('Excluding out-of-stock');
    return parts.length ? `Filters — ${parts.join(' · ')}` : 'All items, no filters applied';
  }

  /** Fetches every item matching the current filters (ignoring the on-screen
   *  page) so exports always cover the full filtered result set. */
  private fetchAllFilteredItems() {
    const branchId = this.auth.currentBranchId();
    if (!branchId) return of(null);
    return this.inventorySvc.getItems({
      branchId,
      status: this.status() === '' ? undefined : Number(this.status()),
      search: this.search() || undefined,
      excludeOutOfStock: this.excludeOutOfStock() || undefined,
      page: 1,
      pageSize: EXPORT_PAGE_SIZE,
    }).pipe(catchError(() => of(null)));
  }

  exportAsPdf(): void {
    this.showExportMenu.set(false);
    this.exporting.set('pdf');
    this.fetchAllFilteredItems().subscribe(res => {
      this.exporting.set(null);
      if (!res) { this.error.set('Failed to export inventory. Please try again.'); return; }
      exportInventoryPdf(res.items ?? [], {
        branchName: this.userProfileSvc.branchName(),
        filtersSummary: this.currentFiltersSummary(),
      });
    });
  }

  exportAsExcel(): void {
    this.showExportMenu.set(false);
    this.exporting.set('excel');
    this.fetchAllFilteredItems().subscribe(res => {
      this.exporting.set(null);
      if (!res) { this.error.set('Failed to export inventory. Please try again.'); return; }
      exportInventoryExcel(res.items ?? [], {
        branchName: this.userProfileSvc.branchName(),
        filtersSummary: this.currentFiltersSummary(),
      });
    });
  }
}
