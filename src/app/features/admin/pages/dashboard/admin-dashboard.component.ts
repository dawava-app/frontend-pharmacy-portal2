import { Component, inject, computed } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { MapComponent } from '../../../../shared/components/map/map.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [MapComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl:    './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly auth = inject(AuthService);

  fullName = computed(() => this.auth.currentUser()?.fullName || 'Admin');

  systemStats = [
    { label: 'Total Branches',  value: '12',    icon: 'pi pi-building',      color: 'brand', change: '+2 this quarter' },
    { label: 'Active Staff',    value: '248',   icon: 'pi pi-users',          color: 'blue',  change: '+12 this month' },
    { label: 'Total Inventory', value: '62,400',icon: 'pi pi-box',            color: 'brand', change: '+5.1% this month' },
    { label: 'Monthly Revenue', value: '$1.2M', icon: 'pi pi-wallet',         color: 'green', change: '+18% vs last month' },
  ];

  branches = [
    { name: 'Main Branch – Riyadh',     status: 'Active',   staff: 48, revenue: '$42,800' },
    { name: 'North Branch – Jeddah',    status: 'Active',   staff: 36, revenue: '$31,200' },
    { name: 'East Branch – Dammam',     status: 'Active',   staff: 29, revenue: '$22,500' },
    { name: 'West Branch – Makkah',     status: 'Inactive', staff: 0,  revenue: '$0' },
  ];

  recentActivity = [
    { action: 'New branch onboarded',    time: '2 hours ago',   type: 'success' },
    { action: 'Staff account created',   time: '4 hours ago',   type: 'info' },
    { action: 'Inventory low – Riyadh',  time: '6 hours ago',   type: 'warning' },
    { action: 'Monthly report generated',time: '1 day ago',     type: 'info' },
    { action: 'Password policy updated', time: '2 days ago',    type: 'info' },
  ];

  /* HQ map coordinates */
  hqLat   = 24.6877;
  hqLng   = 46.7219;
  hqLabel = 'HQ – Riyadh';
}
