import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { OnboardingStateService } from '../../../onboarding/services/onboarding-state.service';
import { UserProfileService } from '../../../../shared/services/user-profile.service';
import { InventoryService } from '../../../../shared/services/inventory.service';
import { MapComponent } from '../../../../shared/components/map/map.component';
import {
  InventorySummary,
  InventoryItem,
  DailyTimelinePoint,
  TopActiveVariant,
} from '../../../../shared/models/inventory.model';
import { catchError, of } from 'rxjs';

const TREND_DAYS = 7;

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent, RouterLink],
  templateUrl: './manager-dashboard.component.html',
  styleUrl:    './manager-dashboard.component.scss',
})
export class ManagerDashboardComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly state          = inject(OnboardingStateService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly inventorySvc   = inject(InventoryService);

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
  timeline = signal<DailyTimelinePoint[]>([]);
  topActive = signal<TopActiveVariant[]>([]);
  lowStockItems = signal<InventoryItem[]>([]);

  days = computed(() =>
    this.timeline().map(p => new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase())
  );

  /** Net stock change per day (added - reduced), used for the Stock Trends line. */
  netTrendValues = computed(() => this.timeline().map(p => p.addedQuantity - p.reducedQuantity));

  /** SVG path for the Stock Trends line chart, built from real daily net-change data. */
  stockTrendPath = computed(() => {
    const values = this.netTrendValues();
    if (values.length === 0) return '';
    const width = 548, height = 160, pad = 12;
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((v, i) => {
      const x = i * step;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${points.join(' L')}`;
  });

  /** Bar heights (%) for the Transaction Volume chart, from real per-day counts. */
  transactionBars = computed(() => {
    const values = this.timeline().map(p => p.count);
    const max = Math.max(...values, 1);
    return values.map(v => Math.max(4, Math.round((v / max) * 100)));
  });

  staffGroups = [
    { name: 'Pharmacists', total: 28, status: 'All On Duty', statusClass: 'success' },
    { name: 'Technicians', total: 15, status: '1 On Leave',  statusClass: 'warning' },
  ];

  constructor() {
    effect(() => {
      const branchId = this.auth.currentBranchId();
      if (!branchId) return;
      this.loadDashboard(branchId);
    });
  }

  private loadDashboard(branchId: string): void {
    this.loading.set(true);

    this.inventorySvc.getSummary(branchId).pipe(
      catchError(() => of(null)),
    ).subscribe(res => this.summary.set(res));

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (TREND_DAYS - 1));

    this.inventorySvc.getTransactionsStats({
      branchId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }).pipe(
      catchError(() => of(null)),
    ).subscribe(res => {
      this.timeline.set(res?.dailyTimeline ?? []);
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

  lowStockBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('out')) return 'badge-danger';
    return 'badge-pending';
  }
}
