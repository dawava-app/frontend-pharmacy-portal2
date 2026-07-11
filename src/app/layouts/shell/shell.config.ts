import { NavItem } from '../../shared/models/nav.model';

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',         route: '/admin/dashboard' },
  { label: 'Inventory Control', icon: 'pi pi-box',          route: '/admin/inventory' },
  { label: 'Pharmacy Branches', icon: 'pi pi-building',     route: '/admin/branches' },
  { label: 'Staff Management',  icon: 'pi pi-users',        route: '/admin/staff' },
  { label: 'Transactions',      icon: 'pi pi-credit-card',  route: '/admin/transactions' },
  { label: 'Onboarding',        icon: 'pi pi-user-plus',    route: '/admin/onboarding' },
  { label: 'Roles & Permissions', icon: 'pi pi-shield',      route: '/admin/roles' },
];

export const MANAGER_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',          route: '/manager/dashboard', guard: 'dashboard' },
  { label: 'Inventory',         icon: 'pi pi-box',           route: '/manager/inventory', guard: 'inventory' },
  { label: 'Sales',             icon: 'pi pi-shopping-cart', route: '/manager/sales',     guard: 'sales'     },
  { label: 'Messages',          icon: 'pi pi-comments',      route: '/manager/messages',  guard: 'messages'  },
  { label: 'Staff Management',  icon: 'pi pi-users',         route: '/manager/staff' },
  { label: 'Settings',          icon: 'pi pi-cog',           route: '/manager/settings' },
];

export const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'pi pi-home',          route: '/staff/dashboard',  guard: 'dashboard' },
  { label: 'Inventory',         icon: 'pi pi-box',           route: '/staff/inventory',  guard: 'inventory' },
  { label: 'Sales',             icon: 'pi pi-shopping-cart', route: '/staff/sales',      guard: 'sales'     },
  { label: 'Messages',          icon: 'pi pi-comments',      route: '/staff/messages',   guard: 'messages'  },
  { label: 'Settings',          icon: 'pi pi-cog',           route: '/staff/settings' },
];
