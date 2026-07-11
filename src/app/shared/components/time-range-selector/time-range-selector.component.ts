import { Component, EventEmitter, HostListener, Output, signal, computed, input } from '@angular/core';
import { TIME_RANGE_OPTIONS, TimeRangeKey } from '../../models/chart.model';

@Component({
  selector: 'app-time-range-selector',
  standalone: true,
  templateUrl: './time-range-selector.component.html',
  styleUrl: './time-range-selector.component.scss',
})
export class TimeRangeSelectorComponent {
  value = input.required<TimeRangeKey>();
  @Output() valueChange = new EventEmitter<TimeRangeKey>();

  readonly options = TIME_RANGE_OPTIONS;
  isOpen = signal(false);

  currentLabel = computed(() => this.options.find(o => o.key === this.value())?.label ?? 'Last 7 Days');

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  select(key: TimeRangeKey): void {
    if (key !== this.value()) this.valueChange.emit(key);
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }
}
