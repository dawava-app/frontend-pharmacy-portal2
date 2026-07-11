import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { OnboardingStateService } from '../../../features/onboarding/services/onboarding-state.service';
import { UserProfileService } from '../../services/user-profile.service';
import { InventoryService } from '../../services/inventory.service';
import { StaffManagementService, StaffAssignment } from '../../../core/services/staff-management.service';
import { FileService } from '../../../core/services/file.service';
import { MapComponent } from '../map/map.component';
import { TimeRangeSelectorComponent } from '../time-range-selector/time-range-selector.component';
import {
  InventorySummary,
  InventoryItem,
  TopActiveVariant,
  DashboardAnalytics,
} from '../../models/inventory.model';
import { TimeRangeKey, timeRangeDays } from '../../models/chart.model';
import { dailyRangeBounds, toLocalIsoDateTime } from '../../utils/chart-data.util';
import { getInitials, avatarColorFor } from '../../utils/avatar.util';
import { buildLineChartOptions, buildBarChartOptions } from './chart-options';
import { catchError, of } from 'rxjs';

/** Fixed lookback window for "Most Active Medicines" — independent of the
 *  charts' time-range selector so that control only affects the two charts. */
const TOP_ACTIVE_WINDOW_DAYS = 7;

/** How many staff members the dashboard preview card shows — "View All"
 *  links to the full Staff Management page for the rest. */
const RECENT_STAFF_LIMIT = 3;

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
  private readonly staffSvc       = inject(StaffManagementService);
  private readonly fileSvc        = inject(FileService);
  private readonly theme          = inject(ThemeService);

  isManager = computed(() => this.auth.userRole() === 'manager');
  basePath  = computed(() => `/${this.auth.userRole() ?? 'staff'}`);

  /** Decoded from the JWT `guard` claim — gates the whole dashboard view. */
  hasDashboardGuard = computed(() => this.auth.hasGuard('dashboard'));

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

  today = new Date();

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
  recentStaff = signal<StaffAssignment[]>([]);

  /** Revenue/sales snapshot fixed to today — independent of the charts'
   *  time-range selector, same as the other top analytics cards. */
  todayAnalytics = signal<DashboardAnalytics | null>(null);

  currencyCode = computed(() =>
    this.todayAnalytics()?.currency || this.summary()?.currencyCode || 'SAR'
  );
  revenueToday    = computed(() => this.todayAnalytics()?.summary.revenue ?? null);
  salesCountToday = computed(() => this.todayAnalytics()?.summary.salesCount ?? null);

  /* ---------- Charts ---------- */

  selectedRange = signal<TimeRangeKey>('7d');
  chartsLoading = signal(true);

  /** Backs both charts and their summary lines for the selected range. This
   *  is the only place that reads the analytics DTO — swapping backend
   *  shapes later only touches loadChartsData() and the point-mapping
   *  computeds directly below it. */
  private rangeAnalytics = signal<DashboardAnalytics | null>(null);

  stockTrendPoints = computed(() =>
    (this.rangeAnalytics()?.stockTimeline ?? []).map(p => ({ date: p.date, value: p.totalQuantity }))
  );

  /** Change in stock level from the start to the end of the selected range —
   *  a snapshot metric, so a sum wouldn't mean anything; the delta does. */
  stockLevelDelta = computed(() => {
    const pts = this.stockTrendPoints();
    if (pts.length < 2) return 0;
    return pts[pts.length - 1].value - pts[0].value;
  });

  /** Stock level is a snapshot, not activity — even an all-zero (fully out of
   *  stock) run is meaningful and should render, not be replaced by an empty
   *  state. Only "no data came back at all" counts as empty here. */
  stockTrendIsEmpty = computed(() => this.stockTrendPoints().length === 0);

  revenueTrendPoints = computed(() =>
    (this.rangeAnalytics()?.salesTimeline ?? []).map(p => ({ date: p.date, value: p.revenue }))
  );
  salesVolumePoints = computed(() =>
    (this.rangeAnalytics()?.salesTimeline ?? []).map(p => ({ date: p.date, value: p.transactionCount }))
  );

  /** Manager sees money (Revenue Trend), staff sees a plain count (Sales
   *  Volume) — same underlying salesTimeline, different metric plotted. */
  secondaryChartPoints = computed(() => this.isManager() ? this.revenueTrendPoints() : this.salesVolumePoints());
  secondaryChartIsEmpty = computed(() => this.secondaryChartPoints().every(p => p.value === 0));
  secondaryChartSummaryValue = computed(() => this.isManager()
    ? (this.rangeAnalytics()?.summary.revenue.currentValue ?? 0)
    : (this.rangeAnalytics()?.summary.salesCount.currentValue ?? 0)
  );

  stockTrendChartOptions = computed(() => buildLineChartOptions(this.stockTrendPoints(), this.theme.isDark(), {
    seriesName: 'Stock Level',
    valueFormatter: v => `${v.toLocaleString()} units`,
  }));

  secondaryChartOptions = computed(() => {
    const isDark = this.theme.isDark();
    if (this.isManager()) {
      const code = this.currencyCode();
      return buildBarChartOptions(this.revenueTrendPoints(), isDark, {
        seriesName: 'Revenue',
        valueFormatter: v => `${code} ${v.toLocaleString()}`,
      });
    }
    return buildBarChartOptions(this.salesVolumePoints(), isDark, {
      seriesName: 'Sales',
      valueFormatter: v => `${v.toLocaleString()} sales`,
    });
  });

  constructor() {
    effect(() => {
      const branchId = this.auth.currentBranchId();
      if (!branchId || !this.hasDashboardGuard()) return;
      this.loadDashboard(branchId);
    });

    effect(() => {
      const branchId = this.auth.currentBranchId();
      const range    = this.selectedRange();
      if (!branchId || !this.hasDashboardGuard()) return;
      this.loadChartsData(branchId, range);
    });
  }

  private loadDashboard(branchId: string): void {
    this.loading.set(true);

    this.inventorySvc.getSummary(branchId).pipe(
      catchError(() => of(null)),
    ).subscribe(res => this.summary.set(res));

    const { start: topStart, end: topEnd } = dailyRangeBounds(TOP_ACTIVE_WINDOW_DAYS);
    this.inventorySvc.getTransactionsStats({
      branchId,
      startDate: toLocalIsoDateTime(topStart),
      endDate: toLocalIsoDateTime(topEnd),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.topActive.set((res?.topActiveVariants ?? []).slice(0, 3));
    });

    const { start: todayStart, end: todayEnd } = dailyRangeBounds(1);
    this.inventorySvc.getAnalytics({
      branchId,
      startDate: toLocalIsoDateTime(todayStart),
      endDate: toLocalIsoDateTime(todayEnd),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => this.todayAnalytics.set(res));

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

    // Staff Management preview card is manager-only — skip the fetch otherwise.
    if (this.isManager()) {
      this.staffSvc.getAssignments(branchId, undefined, undefined, true, 1, RECENT_STAFF_LIMIT).pipe(
        catchError(() => of(null)),
      ).subscribe(res => {
        const assignments = res?.success ? res.data.assignments : [];
        this.recentStaff.set(assignments);
        assignments.forEach(a => this.resolveStaffProfile(a));
      });
    }
  }

  /** The assignments list carries stale/empty fullName and imageId — the
   *  Staff Management page never trusts them either, it re-fetches the live
   *  profile per user. Mirror that here: fullName and the real avatar photo
   *  both come from getUserProfile(), not from the assignment record. */
  private resolveStaffProfile(assignment: StaffAssignment): void {
    this.staffSvc.getUserProfile(assignment.userId).pipe(
      catchError(() => of(null)),
    ).subscribe(profile => {
      if (!profile) return;

      const fullName: string = profile.fullName || assignment.username;
      this.recentStaff.update(list =>
        list.map(p => p.id === assignment.id ? { ...p, fullName } : p)
      );

      if (!profile.imageId) return;
      this.fileSvc.getFile(profile.imageId).pipe(
        catchError(() => of(null)),
      ).subscribe(file => {
        if (!file?.fileLink) return;
        this.recentStaff.update(list =>
          list.map(p => p.id === assignment.id ? { ...p, avatarUrl: file.fileLink } : p)
        );
      });
    });
  }

  staffInitials(name?: string): string {
    return getInitials(name);
  }

  staffAvatarColor(name?: string): string {
    return avatarColorFor(name);
  }

  private loadChartsData(branchId: string, range: TimeRangeKey): void {
    this.chartsLoading.set(true);
    const { start, end } = dailyRangeBounds(timeRangeDays(range));

    this.inventorySvc.getAnalytics({
      branchId,
      startDate: toLocalIsoDateTime(start),
      endDate: toLocalIsoDateTime(end),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.rangeAnalytics.set(res);
      this.chartsLoading.set(false);
    });
  }

  lowStockBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('out')) return 'badge-danger';
    return 'badge-pending';
  }
}
