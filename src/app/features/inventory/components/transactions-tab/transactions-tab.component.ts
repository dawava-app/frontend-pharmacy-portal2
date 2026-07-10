import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, tap, catchError, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { InventoryService } from '../../../../shared/services/inventory.service';
import {
  InventoryTransaction,
  InventoryTransactionsStats,
} from '../../../../shared/models/inventory.model';

@Component({
  selector: 'app-inventory-transactions-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions-tab.component.html',
  styleUrl: './transactions-tab.component.scss',
})
export class TransactionsTabComponent {
  private readonly auth         = inject(AuthService);
  private readonly inventorySvc = inject(InventoryService);

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
      a.download = `inventory-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  deltaClass(delta: number): string {
    return delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-neutral';
  }

  trackById(_: number, item: InventoryTransaction): string { return item.id; }
}
