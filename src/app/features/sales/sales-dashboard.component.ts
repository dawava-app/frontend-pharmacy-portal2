import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, tap, catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InventoryService } from '../../shared/services/inventory.service';
import { UserProfileService } from '../../shared/services/user-profile.service';
import { InventoryTransaction, InventoryTransactionsStats } from '../../shared/models/inventory.model';
import { printReceipts } from '../../shared/utils/receipt-print.util';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.scss',
})
export class SalesDashboardComponent {
  private readonly auth           = inject(AuthService);
  private readonly inventorySvc   = inject(InventoryService);
  private readonly userProfileSvc = inject(UserProfileService);

  stats        = signal<InventoryTransactionsStats | null>(null);
  statsLoading = signal(true);

  items        = signal<InventoryTransaction[]>([]);
  itemsLoading = signal(true);
  error        = signal('');
  exporting    = signal(false);

  search    = signal('');
  source    = signal('');
  startDate = signal('');
  endDate   = signal('');
  page      = signal(1);
  pageSize  = 20;
  totalCount = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  selectedIds = signal<Set<string>>(new Set());
  allOnPageSelected = computed(() => {
    const ids = this.items().map(i => i.id);
    return ids.length > 0 && ids.every(id => this.selectedIds().has(id));
  });

  private readonly search$ = new Subject<string>();

  constructor() {
    effect(() => {
      const branchId = this.auth.currentBranchId();
      if (!branchId) return;
      this.page.set(1);
      this.reload();
    });

    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      tap(value => { this.search.set(value); this.page.set(1); }),
    ).subscribe(() => this.loadTransactions());
  }

  private isoOrUndefined(value: string): string | undefined {
    return value ? new Date(value).toISOString() : undefined;
  }

  private loadStats(): void {
    const branchId = this.auth.currentBranchId();
    if (!branchId) return;
    this.statsLoading.set(true);
    this.inventorySvc.getTransactionsStats({
      branchId,
      source: this.source() || undefined,
      startDate: this.isoOrUndefined(this.startDate()),
      endDate: this.isoOrUndefined(this.endDate()),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.stats.set(res);
      this.statsLoading.set(false);
    });
  }

  private loadTransactions(): void {
    const branchId = this.auth.currentBranchId();
    if (!branchId) return;
    this.itemsLoading.set(true);
    this.error.set('');
    this.inventorySvc.getTransactions({
      branchId,
      source: this.source() || undefined,
      startDate: this.isoOrUndefined(this.startDate()),
      endDate: this.isoOrUndefined(this.endDate()),
      search: this.search() || undefined,
      page: this.page(),
      pageSize: this.pageSize,
    }).pipe(
      tap(res => {
        this.items.set(res.items ?? []);
        this.totalCount.set(res.totalCount ?? res.items?.length ?? 0);
        this.itemsLoading.set(false);
      }),
      catchError(() => {
        this.items.set([]);
        this.totalCount.set(0);
        this.itemsLoading.set(false);
        this.error.set('Failed to load transactions. Please try again.');
        return of(null);
      }),
    ).subscribe();
  }

  reload(): void {
    this.loadStats();
    this.loadTransactions();
  }

  onSearchInput(value: string): void {
    this.search$.next(value);
  }

  onFilterChange(): void {
    this.page.set(1);
    this.reload();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadTransactions();
  }

  exportCsv(): void {
    const branchId = this.auth.currentBranchId();
    if (!branchId) return;
    this.exporting.set(true);
    this.inventorySvc.exportTransactions({
      branchId,
      source: this.source() || undefined,
      startDate: this.isoOrUndefined(this.startDate()),
      endDate: this.isoOrUndefined(this.endDate()),
      search: this.search() || undefined,
    }).pipe(
      catchError(() => {
        this.error.set('Failed to export transactions.');
        return of(null);
      }),
    ).subscribe(blob => {
      this.exporting.set(false);
      if (!blob) return;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dawava-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  /* ---- Selection ---- */

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedIds.set(next);
  }

  toggleSelectAllOnPage(): void {
    const next = new Set(this.selectedIds());
    const ids = this.items().map(i => i.id);
    if (this.allOnPageSelected()) {
      ids.forEach(id => next.delete(id));
    } else {
      ids.forEach(id => next.add(id));
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /* ---- Print receipt ---- */

  printSelectedReceipts(): void {
    const selected = this.items().filter(tx => this.selectedIds().has(tx.id));
    if (selected.length === 0) return;
    printReceipts(selected, {
      branchName: this.userProfileSvc.branchName(),
      pharmacyName: this.userProfileSvc.pharmacyName(),
    });
  }

  deltaClass(delta: number): string {
    return delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-neutral';
  }

  trackById(_: number, item: InventoryTransaction): string { return item.id; }
}
