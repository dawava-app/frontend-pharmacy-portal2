import { SecurityGuard } from './auth.model';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  guard?: SecurityGuard;
}
