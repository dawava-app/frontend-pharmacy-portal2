import { Component, inject, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { MapComponent } from '../../../../shared/components/map/map.component';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [DatePipe, MapComponent],
  templateUrl: './staff-dashboard.component.html',
  styleUrl:    './staff-dashboard.component.scss',
})
export class StaffDashboardComponent {
  private readonly auth = inject(AuthService);
  today = new Date();

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  firstName = computed(() => {
    const name = this.auth.currentUser()?.fullName || 'User';
    return name.split(' ')[0];
  });

  /* Static branch location – will be replaced by real API data */
  branchLat = 24.7136;
  branchLng = 46.6753;
  branchLabel = 'Main Branch – Riyadh';

  stats = [
    { label: 'Total Medicines', value: '1,240', trend: '+2% from last month', up: true, icon: 'pi-prime', color: 'default' },
    { label: 'Out-of-Stock',    value: '12',    trend: 'Requires attention', up: false, icon: 'pi-exclamation-triangle', color: 'danger' },
    { label: "Today's Revenue", value: '$4,250', trend: '12% vs yesterday',   up: true,  icon: 'pi-dollar', color: 'brand' },
  ];

  lowStockItems = [
    { name: 'Amoxicillin 500mg', qty: 12, badge: 'HIGH DEMAND', badgeClass: 'danger' },
    { name: 'Lisinopril 10mg',   qty: 8,  badge: 'STEADY',      badgeClass: 'warning' },
    { name: 'Metformin 850mg',   qty: 5,  badge: 'HIGH DEMAND', badgeClass: 'danger' },
  ];

  topSearched = [
    { rank: 1, name: 'Amoxicillin',  count: '84 searches' },
    { rank: 2, name: 'Paracetamol',  count: '62 searches' },
    { rank: 3, name: 'Ibuprofen',    count: '58 searches' },
    { rank: 4, name: 'Omeprazole',   count: '41 searches' },
  ];

  salesBars = [
    { day: 'MON', pct: 60 }, { day: 'TUE', pct: 70 }, { day: 'WED', pct: 100 },
    { day: 'THU', pct: 50 }, { day: 'FRI', pct: 80 },  { day: 'SAT', pct: 40 },
    { day: 'SUN', pct: 30 },
  ];
}
