import { Component, inject, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { OnboardingStateService } from '../../../onboarding/services/onboarding-state.service';
import { MapComponent } from '../../../../shared/components/map/map.component';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [MapComponent],
  templateUrl: './manager-dashboard.component.html',
  styleUrl:    './manager-dashboard.component.scss',
})
export class ManagerDashboardComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  firstName = computed(() => {
    const name = this.auth.currentUser()?.fullName || 'Manager';
    return name.split(' ')[0];
  });

  branchLabel = computed(() => {
    const scopes    = this.auth.availableScopes();
    const currentId = this.auth.currentBranchId();
    const scope     = scopes.find(s => s.branch_id === currentId) ?? scopes[0];
    return scope?.branch_name
      ?? this.state.branchInfo()?.branchName
      ?? 'Main Branch';
  });

  branchLat = 30.0444;
  branchLng = 31.2357;

  ngOnInit(): void {
    const info = this.state.branchInfo();
    if (info?.lat != null) this.branchLat = info.lat;
    if (info?.lng != null) this.branchLng = info.lng;
  }

  applyForNewPharmacy(): void {
    this.state.clearApplication();
    this.router.navigate(['/onboarding/step1']);
  }

  stats = [
    { label: 'Total Medicines', value: '5,420', change: '+2.5% this month',      up: true,  color: 'teal' },
    { label: 'Out-of-Stock',    value: '8',     change: 'Requires Attention',    up: false, color: 'red'  },
    { label: 'Daily Revenue',   value: '$12,840', change: '+15% from yesterday', up: true,  color: 'teal' },
  ];

  salesBars = [45, 40, 55, 60, 50, 68, 75];
  days      = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

  staffGroups = [
    { name: 'Pharmacists', total: 28, status: 'All On Duty', statusClass: 'success' },
    { name: 'Technicians', total: 15, status: '1 On Leave',  statusClass: 'warning' },
  ];

  topMedicines = [
    { name: 'Paracetamol 500mg', type: 'Pain Relief', sold: 1240 },
    { name: 'Amoxicillin 250mg', type: 'Antibiotic',  sold: 856  },
    { name: 'Vitamin C 1000mg',  type: 'Supplement',  sold: 642  },
  ];

  lowStock = [
    { name: 'Lisinopril 10mg',  current: 12, min: 50, status: 'Critical',          cls: 'danger'  },
    { name: 'Metformin 500mg',  current: 5,  min: 40, status: 'Out of Stock Soon', cls: 'warning' },
  ];
}
