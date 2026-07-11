import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { OnboardingStateService } from '../../../features/onboarding/services/onboarding-state.service';
import { UserProfileService } from '../../services/user-profile.service';
import { InventoryService } from '../../services/inventory.service';
import { MapComponent } from '../map/map.component';
import { TimeRangeSelectorComponent } from '../time-range-selector/time-range-selector.component';
import {
  InventorySummary,
  InventoryItem,
  DailyTimelinePoint,
  TopActiveVariant,
} from '../../models/inventory.model';
import { ChartPoint, TimeRangeKey, timeRangeDays } from '../../models/chart.model';
import { zeroFillDailyRange, dailyRangeBounds } from '../../utils/chart-data.util';
import { buildLineChartOptions, buildBarChartOptions } from './chart-options';
import { catchError, of } from 'rxjs';

/** Fixed lookback window for "Most Active Medicines" — independent of the
 *  charts' time-range selector so that control only affects the two charts. */
const TOP_ACTIVE_WINDOW_DAYS = 7;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent, RouterLink, ChartComponent, TimeRangeSelectorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl:    './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly state          = inject(OnboardingStateService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly inventorySvc   = inject(InventoryService);
  private readonly theme          = inject(ThemeService);

  isManager = computed(() => this.auth.userRole() === 'manager');
  basePath  = computed(() => `/${this.auth.userRole() ?? 'staff'}`);

  firstName = computed(() => {
    const name = this.userProfileSvc.profile()?.fullName
              ?? this.auth.currentUser()?.fullName
              ?? 'Manager';
    return name.split(' ')[0];
  });

  pharmacyName = this.userProfileSvc.pharmacyName;
  branchName   = this.userProfileSvc.branchName;
  branchAddress = this.userProfileSvc.branchAddress;

  branchLabel = computed(() => {
    const real = this.userProfileSvc.branchName();
    if (real) return real;
    const scopes    = this.auth.availableScopes();
    const currentId = this.auth.currentBranchId();
    const scope     = scopes.find(s => s.branch_id === currentId) ?? scopes[0];
    return scope?.branch_name ?? this.state.branchInfo()?.branchName ?? 'Main Branch';
  });

  branchLat = computed(() => this.userProfileSvc.branchLat());
  branchLng = computed(() => this.userProfileSvc.branchLng());

  ngOnInit(): void {
    if (!this.userProfileSvc.profileLoaded()) {
      this.userProfileSvc.loadProfile().subscribe();
    }
    if (!this.userProfileSvc.branchLoaded()) {
      this.userProfileSvc.loadBranch().subscribe();
    }
  }

  /* ---------- Live data ---------- */

  loading = signal(true);
  summary = signal<InventorySummary | null>(null);
  topActive = signal<TopActiveVariant[]>([]);
  lowStockItems = signal<InventoryItem[]>([]);

  staffGroups = [
    { name: 'Pharmacists', total: 28, status: 'All On Duty', statusClass: 'success' },
    { name: 'Technicians', total: 15, status: '1 On Leave',  statusClass: 'warning' },
  ];

  /* ---------- Charts ---------- */

  selectedRange = signal<TimeRangeKey>('7d');
  chartsLoading = signal(true);

  /** Adapter output only — the one place that knows the current backend DTO
   *  shape. Swapping in a dedicated chart endpoint later only touches
   *  loadChartsData() and these two adapters below. */
  private rawStockTrend        = signal<ChartPoint[]>([]);
  private rawTransactionVolume = signal<ChartPoint[]>([]);

  private chartRangeBounds = computed(() => dailyRangeBounds(timeRangeDays(this.selectedRange())));

  stockTrendPoints = computed(() => {
    const { start, end } = this.chartRangeBounds();
    return zeroFillDailyRange(this.rawStockTrend(), start, end);
  });

  transactionVolumePoints = computed(() => {
    const { start, end } = this.chartRangeBounds();
    return zeroFillDailyRange(this.rawTransactionVolume(), start, end);
  });

  stockTrendChartOptions        = computed(() => buildLineChartOptions(this.stockTrendPoints(), this.theme.isDark()));
  transactionVolumeChartOptions = computed(() => buildBarChartOptions(this.transactionVolumePoints(), this.theme.isDark()));

  netStockChangeTotal  = computed(() => this.stockTrendPoints().reduce((sum, p) => sum + p.value, 0));
  transactionsTotal    = computed(() => this.transactionVolumePoints().reduce((sum, p) => sum + p.value, 0));

  stockTrendIsEmpty        = computed(() => this.stockTrendPoints().every(p => p.value === 0));
  transactionVolumeIsEmpty = computed(() => this.transactionVolumePoints().every(p => p.value === 0));

  constructor() {
    effect(() => {
      const branchId = this.auth.currentBranchId();
      if (!branchId) return;
      this.loadDashboard(branchId);
    });

    effect(() => {
      const branchId = this.auth.currentBranchId();
      const range    = this.selectedRange();
      if (!branchId) return;
      this.loadChartsData(branchId, range);
    });
  }

  private loadDashboard(branchId: string): void {
    this.loading.set(true);

    this.inventorySvc.getSummary(branchId).pipe(
      catchError(() => of(null)),
    ).subscribe(res => this.summary.set(res));

    const { start, end } = dailyRangeBounds(TOP_ACTIVE_WINDOW_DAYS);
    this.inventorySvc.getTransactionsStats({
      branchId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.topActive.set((res?.topActiveVariants ?? []).slice(0, 3));
    });

    // No dedicated "low stock" endpoint exists yet, so we pull a page of items
    // and filter/sort client-side for anything not fully "Available".
    this.inventorySvc.getItems({ branchId, page: 1, pageSize: 100 }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      const items = (res?.items ?? [])
        .filter(i => i.status?.toLowerCase() !== 'available')
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);
      this.lowStockItems.set(items);
      this.loading.set(false);
    });
  }

  /** Adapts the current transactions/stats DTO into generic ChartPoints. This
   *  is the only spot that reads DailyTimelinePoint — the charts themselves
   *  only ever see ChartPoint[], so a future dedicated chart endpoint only
   *  requires changing this method. */
  private loadChartsData(branchId: string, range: TimeRangeKey): void {
    this.chartsLoading.set(true);
    const { start, end } = dailyRangeBounds(timeRangeDays(range));

    this.inventorySvc.getTransactionsStats({
      branchId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      const timeline = res?.dailyTimeline ?? [];
      this.rawStockTrend.set(this.toNetChangePoints(timeline));
      this.rawTransactionVolume.set(this.toTransactionCountPoints(timeline));
      this.chartsLoading.set(false);
    });
  }

  private toNetChangePoints(timeline: DailyTimelinePoint[]): ChartPoint[] {
    return timeline.map(p => ({ date: p.date, value: p.addedQuantity - p.reducedQuantity }));
  }

  private toTransactionCountPoints(timeline: DailyTimelinePoint[]): ChartPoint[] {
    return timeline.map(p => ({ date: p.date, value: p.count }));
  }

  lowStockBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('out')) return 'badge-danger';
    return 'badge-pending';
  }
}
