import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platform = inject(PLATFORM_ID);
  readonly isDark = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platform)) {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDark.set(saved === 'dark' || (!saved && prefersDark));
      this.applyTheme(this.isDark());
    }

    effect(() => {
      const dark = this.isDark();
      this.applyTheme(dark);
      if (isPlatformBrowser(this.platform)) {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  private applyTheme(dark: boolean): void {
    if (isPlatformBrowser(this.platform)) {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
  }
}
