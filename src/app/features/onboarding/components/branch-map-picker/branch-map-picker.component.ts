import {
  Component, Input, Output, EventEmitter,
  ViewChild, ElementRef, AfterViewInit, OnChanges, OnDestroy, SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-branch-map-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './branch-map-picker.component.html',
  styleUrl: './branch-map-picker.component.scss',
})
export class BranchMapPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Output() locationChange = new EventEmitter<{ lat: number; lng: number }>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map: any;
  private marker: any;
  private L: any;
  private skipNextChange = false;
  private resizeObserver: ResizeObserver | null = null;

  manualLat = '';
  manualLng = '';
  detecting = false;
  detectError = '';

  readonly DEFAULT_LAT = 30.0444;
  readonly DEFAULT_LNG = 31.2357;

  async ngAfterViewInit() {
    await this.initMap();
    if (this.lat && this.lng) {
      this.manualLat = this.lat.toFixed(6);
      this.manualLng = this.lng.toFixed(6);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.skipNextChange) { this.skipNextChange = false; return; }
    if (this.map && (changes['lat'] || changes['lng'])) {
      const lat = this.lat ?? this.DEFAULT_LAT;
      const lng = this.lng ?? this.DEFAULT_LNG;
      this.map.setView([lat, lng], this.map.getZoom());
      this.marker?.setLatLng([lat, lng]);
      this.manualLat = lat.toFixed(6);
      this.manualLng = lng.toFixed(6);
    }
  }

  private async initMap() {
    this.L = (await import('leaflet')).default as any;
    const L = this.L;

    const initLat = this.lat ?? this.DEFAULT_LAT;
    const initLng = this.lng ?? this.DEFAULT_LNG;

    this.map = L.map(this.mapEl.nativeElement, {
      center: [initLat, initLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    const dotIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#14b8a5;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.30);"></div>',
      iconSize:   [16, 16],
      iconAnchor: [8, 8],
    });

    this.marker = L.marker([initLat, initLng], { draggable: true, icon: dotIcon })
      .addTo(this.map);

    this.marker.on('dragend', () => {
      const { lat, lng } = this.marker.getLatLng();
      this.emitLocation(lat, lng);
    });

    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.marker.setLatLng([lat, lng]);
      this.emitLocation(lat, lng);
    });

    // Leaflet measures container size at init time. Inside a stepper the container
    // may not have its final dimensions yet, so tiles only load for a tiny area.
    // ResizeObserver fires invalidateSize() whenever the container is resized or
    // becomes visible (flex/display change), fixing the blank-tile problem.
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });
    this.resizeObserver.observe(this.mapEl.nativeElement);

    // One-shot fallback: run after the current render cycle so Angular has
    // finished laying out the step card before we recalculate tile coverage.
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private emitLocation(lat: number, lng: number) {
    this.manualLat = lat.toFixed(6);
    this.manualLng = lng.toFixed(6);
    this.detectError = '';
    this.locationChange.emit({ lat, lng });
  }

  detectCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.detectError = 'Geolocation is not supported by your browser.';
      return;
    }
    this.detecting = true;
    this.detectError = '';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.detecting = false;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.map?.setView([lat, lng], 15);
        this.marker?.setLatLng([lat, lng]);
        this.emitLocation(lat, lng);
      },
      () => {
        this.detecting = false;
        this.detectError = 'Unable to detect location. Please allow location access or enter coordinates manually.';
      }
    );
  }

  applyManualCoords(): void {
    const lat = parseFloat(this.manualLat);
    const lng = parseFloat(this.manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      this.detectError = 'Please enter valid numeric coordinates.';
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.detectError = 'Coordinates out of valid range.';
      return;
    }
    this.detectError = '';
    this.map?.setView([lat, lng], 15);
    this.marker?.setLatLng([lat, lng]);
    this.skipNextChange = true;
    this.locationChange.emit({ lat, lng });
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
