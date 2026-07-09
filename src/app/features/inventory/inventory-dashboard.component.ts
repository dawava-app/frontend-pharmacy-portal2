import { Component, signal } from '@angular/core';
import { StockTabComponent } from './components/stock-tab/stock-tab.component';
import { TransactionsTabComponent } from './components/transactions-tab/transactions-tab.component';

type InventoryTab = 'stock' | 'transactions';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [StockTabComponent, TransactionsTabComponent],
  templateUrl: './inventory-dashboard.component.html',
  styleUrl: './inventory-dashboard.component.scss',
})
export class InventoryDashboardComponent {
  activeTab = signal<InventoryTab>('stock');

  setTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
  }
}
