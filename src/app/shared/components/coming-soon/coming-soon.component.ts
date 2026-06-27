import { Component } from '@angular/core';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  template: `
    <div class="coming-soon">
      <div class="coming-soon-icon">
        <i class="pi pi-clock"></i>
      </div>
      <h2>Coming Soon</h2>
      <p>This feature is under active development and will be available in a future release.</p>
    </div>
  `,
  styles: [`
    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      gap: 16px;
      color: var(--color-text-secondary);
    }
    .coming-soon-icon {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: var(--color-brand-surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .coming-soon-icon i {
      font-size: 32px;
      color: var(--color-brand-primary);
    }
    h2 {
      font-size: 22px;
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0;
    }
    p {
      font-size: 14px;
      max-width: 380px;
      line-height: 1.6;
      margin: 0;
    }
  `]
})
export class ComingSoonComponent {}
