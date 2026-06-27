import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const ACCESS_TOKEN_KEY  = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly platform = inject(PLATFORM_ID);
  private _accessToken: string | null = null;

  constructor() {
    if (isPlatformBrowser(this.platform)) {
      this._accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    }
  }

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platform);
  }

  setAccessToken(token: string): void {
    this._accessToken = token;
    if (this.isBrowser) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  getAccessToken(): string | null {
    return this._accessToken;
  }

  setRefreshToken(token: string): void {
    if (this.isBrowser) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  }

  clearAll(): void {
    this._accessToken = null;
    if (this.isBrowser) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  hasTokens(): boolean {
    return !!this._accessToken && !!this.getRefreshToken();
  }
}
