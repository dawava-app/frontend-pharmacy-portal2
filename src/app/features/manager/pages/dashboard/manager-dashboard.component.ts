import { Component, inject, computed, OnInit } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { OnboardingStateService } from '../../../onboarding/services/onboarding-state.service';
import { UserProfileService } from '../../../../shared/services/user-profile.service';
import { MapComponent } from '../../../../shared/components/map/map.component';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [MapComponent],
  templateUrl: './manager-dashboard.component.html',
  styleUrl:    './manager-dashboard.component.scss',
})
export class ManagerDashboardComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly state          = inject(OnboardingStateService);
  private readonly userProfileSvc = inject(UserProfileService);

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
