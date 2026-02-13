import { Component, Input, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, Inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Country } from '../../models/travel.model';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-world-map',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './world-map.component.html',
    styleUrls: ['./world-map.component.css']
})
export class WorldMapComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
    @Input() visitedCountryNames: string[] = [];
    @Input() focusedCountry: Country | null = null;
    @Input() height: string = '500px';
    @Input() heritageSites: any[] = [];
    @Input() visitedPOIIds: string[] = [];
    @Input() showOnlyVisitedSites: boolean = false;

    private map: any | null = null; // maplibre-gl Map instance
    private popup: any | null = null;
    isLoading = true;
    isBrowser: boolean;

    constructor(
        private router: Router,
        private cdr: ChangeDetectorRef,
        private themeService: ThemeService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    ngOnInit() { }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['focusedCountry'] && !changes['focusedCountry'].firstChange) {
            if (this.focusedCountry) {
                this.flyToCountry(this.focusedCountry);
            }
        }
    }

    ngAfterViewInit() {
        if (this.isBrowser) {
            setTimeout(() => this.initializeMap(), 100);
        }
    }

    ngOnDestroy() {
        if (this.popup) {
            this.popup.remove();
        }
        if (this.map) {
            this.map.remove();
        }
    }

    private getCssVar(name: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    private async initializeMap() {
        try {
            const maplibreModule = await import('maplibre-gl');
            const maplibregl = (maplibreModule as any).default || maplibreModule;

            const primaryColor = this.getCssVar('--primary');
            const mapUnvisited = this.getCssVar('--map-unvisited');
            const mapBorder = this.getCssVar('--map-border');
            const mapMarkerMuted = this.getCssVar('--map-marker-muted');

            const center: [number, number] = this.focusedCountry
                ? [this.focusedCountry.longitude, this.focusedCountry.latitude]
                : [0, 20];

            const zoom = this.focusedCountry ? 4 : 1.5;

            const mapStyle = this.themeService.darkMode()
                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

            this.map = new maplibregl.Map({
                container: 'map-container',
                style: mapStyle,
                center: center,
                zoom: zoom,
                attributionControl: false
            });

            this.popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'map-hover-popup'
            });

            this.map.on('load', () => {
                // Add GeoJSON source for world countries
                this.map?.addSource('world-countries', {
                    type: 'geojson',
                    data: '/countries.geojson'
                });

                // Layer for visited countries (Primary Color)
                this.map?.addLayer({
                    id: 'countries-visited-fill',
                    type: 'fill',
                    source: 'world-countries',
                    filter: ['in', ['get', 'name'], ['literal', this.visitedCountryNames]],
                    paint: {
                        'fill-color': primaryColor,
                        'fill-opacity': 0.4
                    }
                });

                // Layer for focused country if not visited (Gray)
                if (this.focusedCountry && !this.visitedCountryNames.includes(this.focusedCountry.name)) {
                    this.map?.addLayer({
                        id: 'countries-focused-fill',
                        type: 'fill',
                        source: 'world-countries',
                        filter: ['==', ['get', 'name'], this.focusedCountry.name],
                        paint: {
                            'fill-color': mapUnvisited,
                            'fill-opacity': 0.4
                        }
                    });
                }

                // Layer for country borders (White/Light Gray)
                this.map?.addLayer({
                    id: 'countries-borders',
                    type: 'line',
                    source: 'world-countries',
                    paint: {
                        'line-color': mapBorder,
                        'line-opacity': 0.2,
                        'line-width': 1
                    }
                });

                // Add heritage sites as points
                if (this.heritageSites.length > 0 && this.map) {
                    // Filter sites based on showOnlyVisitedSites flag
                    const sitesToShow = this.showOnlyVisitedSites
                        ? this.heritageSites.filter(site => this.visitedPOIIds.includes(site.id_no))
                        : this.heritageSites;

                    // Create GeoJSON from heritage sites
                    const geojson: GeoJSON.FeatureCollection = {
                        type: 'FeatureCollection',
                        features: sitesToShow
                            .filter(site => site.longitude && site.latitude)
                            .map(site => ({
                                type: 'Feature' as const,
                                geometry: {
                                    type: 'Point' as const,
                                    coordinates: [site.longitude, site.latitude]
                                },
                                properties: {
                                    id: site.id_no,
                                    name: site.name_en,
                                    visited: this.visitedPOIIds.includes(site.id_no)
                                }
                            }))
                    };

                    // Add source
                    this.map.addSource('heritage-sites', {
                        type: 'geojson',
                        data: geojson
                    });

                    // Add layer for unvisited sites (grey) - only if showing all sites
                    if (!this.showOnlyVisitedSites) {
                        this.map.addLayer({
                            id: 'heritage-sites-unvisited',
                            type: 'circle',
                            source: 'heritage-sites',
                            filter: ['!', ['get', 'visited']],
                            paint: {
                                'circle-radius': 4,
                                'circle-color': mapMarkerMuted,
                                'circle-stroke-color': mapBorder,
                                'circle-stroke-width': 1,
                                'circle-opacity': 0.8
                            }
                        });
                    }

                    // Add layer for visited sites (teal)
                    this.map.addLayer({
                        id: 'heritage-sites-visited',
                        type: 'circle',
                        source: 'heritage-sites',
                        filter: ['get', 'visited'],
                        paint: {
                            'circle-radius': 5,
                            'circle-color': primaryColor,
                            'circle-stroke-color': mapBorder,
                            'circle-stroke-width': 2,
                            'circle-opacity': 1
                        }
                    });
                }

                // Unified hover tooltip — heritage sites take priority over country fills
                this.map?.on('mousemove', (e: any) => {
                    if (!this.map || !this.popup) return;

                    // Build list of layers to check, in priority order
                    const heritageLayers: string[] = [];
                    if (this.map.getLayer('heritage-sites-visited')) heritageLayers.push('heritage-sites-visited');
                    if (this.map.getLayer('heritage-sites-unvisited')) heritageLayers.push('heritage-sites-unvisited');

                    const countryLayers: string[] = [];
                    if (this.map.getLayer('countries-visited-fill')) countryLayers.push('countries-visited-fill');
                    if (this.map.getLayer('countries-focused-fill')) countryLayers.push('countries-focused-fill');

                    // Check heritage sites first (highest priority)
                    if (heritageLayers.length > 0) {
                        const heritageFeatures = this.map.queryRenderedFeatures(e.point, { layers: heritageLayers });
                        if (heritageFeatures.length > 0) {
                            this.map.getCanvas().style.cursor = 'pointer';
                            const coords = heritageFeatures[0].geometry.coordinates.slice();
                            const name = heritageFeatures[0].properties?.name;
                            if (name) {
                                this.popup.setLngLat(coords).setHTML(`<strong>${name}</strong>`).addTo(this.map);
                            }
                            return;
                        }
                    }

                    // Fall back to country fills
                    if (countryLayers.length > 0) {
                        const countryFeatures = this.map.queryRenderedFeatures(e.point, { layers: countryLayers });
                        if (countryFeatures.length > 0) {
                            this.map.getCanvas().style.cursor = 'pointer';
                            const name = countryFeatures[0].properties?.name;
                            if (name) {
                                this.popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>`).addTo(this.map);
                            }
                            return;
                        }
                    }

                    // Nothing under cursor — clear
                    this.map.getCanvas().style.cursor = '';
                    this.popup.remove();
                });

                this.isLoading = false;
                this.cdr.detectChanges(); // Manually trigger change detection
            });

        } catch (error) {
            console.error('Error initializing map:', error);
            this.isLoading = false;
            this.cdr.detectChanges(); // Manually trigger change detection
        }
    }

    private flyToCountry(country: Country) {
        if (this.map && country.latitude && country.longitude) {
            const mapUnvisited = this.getCssVar('--map-unvisited');

            this.map.flyTo({
                center: [country.longitude, country.latitude],
                zoom: 5,
                essential: true // this animation is considered essential with respect to prefers-reduced-motion
            });

            // Update focused country layer if map is loaded
            if (this.map.getLayer('countries-focused-fill')) {
                this.map.removeLayer('countries-focused-fill');
            }

            if (!this.visitedCountryNames.includes(country.name) && this.map.getSource('world-countries')) {
                this.map.addLayer({
                    id: 'countries-focused-fill',
                    type: 'fill',
                    source: 'world-countries',
                    filter: ['==', ['get', 'name'], country.name],
                    paint: {
                        'fill-color': mapUnvisited,
                        'fill-opacity': 0.4
                    }
                }, 'heritage-sites-unvisited'); // Place before heritage sites
            }
        }
    }
}
