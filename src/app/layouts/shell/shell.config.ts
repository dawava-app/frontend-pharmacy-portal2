import { NavItem } from '../../shared/models/nav.model';

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',         route: '/admin/dashboard' },
  { label: 'Inventory Control', icon: 'pi pi-box',          route: '/admin/inventory' },
  { label: 'Pharmacy Branches', icon: 'pi pi-building',     route: '/admin/branches' },
  { label: 'Staff Management',  icon: 'pi pi-users',        route: '/admin/staff' },
  { label: 'Transactions',      icon: 'pi pi-credit-card',  route: '/admin/transactions' },
  { label: 'Reporting',         icon: 'pi pi-chart-bar',    route: '/admin/reports' },
  { label: 'Onboarding',        icon: 'pi pi-user-plus',    route: '/admin/onboarding' },
  { label: 'Roles & Permissions', icon: 'pi pi-shield',      route: '/admin/roles' },
];

export const MANAGER_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',          route: '/manager/dashboard' },
  { label: 'Inventory',         icon: 'pi pi-box',           route: '/manager/inventory' },
  { label: 'Sales',             icon: 'pi pi-shopping-cart', route: '/manager/sales' },
  { label: 'Messages',          icon: 'pi pi-comments',      route: '/manager/messages' },
  { label: 'Staff Management',  icon: 'pi pi-users',         route: '/manager/staff' },
  { label: 'Reports',           icon: 'pi pi-chart-bar',     route: '/manager/reports' },
  { label: 'Settings',          icon: 'pi pi-cog',           route: '/manager/settings' },
];

export const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',          route: '/staff/dashboard' },
  { label: 'Inventory',         icon: 'pi pi-box',           route: '/staff/inventory' },
  { label: 'Sales',             icon: 'pi pi-shopping-cart', route: '/staff/sales' },
  { label: 'Messages',          icon: 'pi pi-comments',      route: '/staff/messages' },
  { label: 'Reports',           icon: 'pi pi-chart-bar',     route: '/staff/reports' },
  { label: 'Settings',          icon: 'pi pi-cog',           route: '/staff/settings' },
];
