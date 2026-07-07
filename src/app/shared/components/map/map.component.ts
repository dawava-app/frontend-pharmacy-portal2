import {
  Component, Input, Output, EventEmitter, OnDestroy, OnChanges,
  ElementRef, ViewChild, AfterViewInit,
} from '@angular/core';

@Component({
  selector: 'app-map',
  standalone: true,
  template: `<div #mapEl class="map-host"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .map-host { width: 100%; height: 100%; border-radius: 12px; }
  `],
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat  = 24.7136;
  @Input() lng  = 46.6753;
  @Input() zoom = 14;
  @Input() label = 'Branch Location';

  // Fires on a genuine tap/click on the map (Leaflet already excludes drag-end from this),
  // with the clicked coordinates so callers can use the map for location selection.
  @Output() locationClick = new EventEmitter<{ lat: number; lng: number }>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map: any;
  private marker: any;

  async ngAfterViewInit() {
    await this.initMap();
  }

  async ngOnChanges() {
    if (this.map) {
      this.map.setView([this.lat, this.lng], this.zoom);
      this.marker?.setLatLng([this.lat, this.lng]);
      this.marker?.setPopupContent(`<b>${this.label}</b>`);
    }
  }

  private async initMap() {
    const L = (await import('leaflet')).default as any;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    this.map = L.map(this.mapEl.nativeElement, {
      center: [this.lat, this.lng],
      zoom: this.zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.marker = L.marker([this.lat, this.lng])
      .addTo(this.map)
      .bindPopup(`<b>${this.label}</b>`)
      .openPopup();

    this.map.on('click', (e: any) => this.locationClick.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
