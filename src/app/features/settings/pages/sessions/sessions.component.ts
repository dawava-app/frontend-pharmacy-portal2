import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfileService, SessionInfo } from '../../../../shared/services/user-profile.service';

export interface ParsedSession extends SessionInfo {
  browserName:  string;
  browserIcon:  string;
  deviceType:   string;
  deviceIcon:   string;
  osName:       string;
}

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
})
export class SessionsComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly router         = inject(Router);

  sessions     = signal<ParsedSession[]>([]);
  loading      = signal(true);
  error        = signal('');
  revoking     = signal<string | null>(null);

  showDialog       = signal(false);
  logoutAllPwd     = '';
  logoutAllLoading = signal(false);
  logoutAllError   = signal('');

  ngOnInit(): void {
    this.fetchSessions();
  }

  private fetchSessions(): void {
    this.loading.set(true);
    this.error.set('');

    this.userProfileSvc.getSessions().subscribe({
      next: sessions => {
        this.sessions.set(
          [...sessions]
            .sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0))
            .map(s => this.parseSession(s))
        );
        this.loading.set(false);
        this.revoking.set(null);
      },
      error: () => {
        this.error.set('Failed to load sessions. Please try again.');
        this.loading.set(false);
        this.revoking.set(null);
      },
    });
  }

  private parseSession(s: SessionInfo): ParsedSession {
    return {
      ...s,
      ...this.detectBrowser(s.user_agent),
      ...this.detectDevice(s.user_agent),
      osName: this.detectOs(s.user_agent),
    };
  }

  private detectBrowser(ua: string): { browserName: string; browserIcon: string } {
    if (/Edg\//i.test(ua))                        return { browserName: 'Edge',    browserIcon: 'edge' };
    if (/OPR\/|Opera\//i.test(ua))                return { browserName: 'Opera',   browserIcon: 'opera' };
    if (/Chrome\//i.test(ua))                     return { browserName: 'Chrome',  browserIcon: 'chrome' };
    if (/Firefox\//i.test(ua))                    return { browserName: 'Firefox', browserIcon: 'firefox' };
    if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return { browserName: 'Safari', browserIcon: 'safari' };
    return { browserName: 'Browser', browserIcon: 'browser' };
  }

  private detectDevice(ua: string): { deviceType: string; deviceIcon: string } {
    if (/iPhone|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua))
      return { deviceType: 'Mobile',  deviceIcon: 'pi pi-mobile' };
    if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua))
      return { deviceType: 'Tablet',  deviceIcon: 'pi pi-tablet' };
    return { deviceType: 'Desktop', deviceIcon: 'pi pi-desktop' };
  }

  private detectOs(ua: string): string {
    if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
    if (/Windows NT 6\.[23]/i.test(ua)) return 'Windows 8';
    if (/Windows NT 6\.1/i.test(ua))   return 'Windows 7';
    if (/Windows/i.test(ua))           return 'Windows';
    if (/Mac OS X/i.test(ua))          return 'macOS';
    if (/Android/i.test(ua))           return 'Android';
    if (/iPhone|iPad/i.test(ua))       return 'iOS';
    if (/Linux/i.test(ua))             return 'Linux';
    return 'Unknown OS';
  }

  timeAgo(ts: number): string {
    const diff = Date.now() - ts * 1000;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  toDate(ts: number): Date {
    return new Date(ts * 1000);
  }

  revokeSession(familyId: string, isCurrent: boolean): void {
    this.revoking.set(familyId);

    this.userProfileSvc.revokeSession(familyId).subscribe({
      next: () => {
        if (isCurrent) {
          // Token is already invalidated server-side; skip the logout API call
          this.auth.clearSession();
        } else {
          // Re-fetch from server instead of filtering locally — the interceptor may
          // have silently refreshed the access token mid-request, creating a new
          // session entry, so the server's list is the only source of truth here.
          this.fetchSessions();
        }
      },
      error: () => {
        this.revoking.set(null);
      },
    });
  }

  openDialog(): void {
    this.logoutAllPwd   = '';
    this.logoutAllError.set('');
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
  }

  confirmLogoutAll(): void {
    if (!this.logoutAllPwd) {
      this.logoutAllError.set('Please enter your current password.');
      return;
    }

    this.logoutAllLoading.set(true);
    this.logoutAllError.set('');

    this.userProfileSvc.revokeAllSessions(this.logoutAllPwd).subscribe({
      next: () => {
        this.logoutAllLoading.set(false);
        // All sessions already terminated server-side; skip the logout API call
        this.auth.clearSession();
      },
      error: (err: unknown) => {
        this.logoutAllLoading.set(false);
        const msg =
          (err as { error?: { message?: string } })?.error?.message
          ?? 'Failed. Please check your password and try again.';
        this.logoutAllError.set(msg);
      },
    });
  }

  refresh(): void {
    this.fetchSessions();
  }

  goBack(): void {
    const role = this.auth.userRole();
    this.router.navigate([role === 'manager' ? '/manager/settings' : '/staff/settings']);
  }
}
