import { Component } from '@angular/core';
import { StockTabComponent } from './components/stock-tab/stock-tab.component';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [StockTabComponent],
  templateUrl: './inventory-dashboard.component.html',
  styleUrl: './inventory-dashboard.component.scss',
})
export class InventoryDashboardComponent {}
