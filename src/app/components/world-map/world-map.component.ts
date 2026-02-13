import { Component, Input, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, Inject, ChangeDetectorRef, OnChanges, SimpleChanges, effect } from '@angular/core';
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
    private mapReady = false;
    private maplibregl: any = null;
    isLoading = true;
    isBrowser: boolean;

    constructor(
        private router: Router,
        private cdr: ChangeDetectorRef,
        private themeService: ThemeService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        // React to theme changes
        effect(() => {
            const isDark = this.themeService.darkMode();
            if (this.map && this.mapReady) {
                this.switchMapStyle(isDark);
            }
        });
    }

    ngOnInit() { }

    ngOnChanges(changes: SimpleChanges) {
        if (!this.map || !this.mapReady) return;

        if (changes['focusedCountry'] && !changes['focusedCountry'].firstChange) {
            if (this.focusedCountry) {
                this.flyToCountry(this.focusedCountry);
            }
        }

        if (changes['visitedCountryNames'] && !changes['visitedCountryNames'].firstChange) {
            this.updateCountryLayers();
        }

        if ((changes['visitedPOIIds'] || changes['heritageSites']) &&
            !(changes['visitedPOIIds']?.firstChange && changes['heritageSites']?.firstChange)) {
            this.updateHeritageLayers();
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

    /**
     * Update visited/focused country layer filters without rebuilding the map
     */
    private updateCountryLayers() {
        if (!this.map) return;

        // Update visited countries filter
        if (this.map.getLayer('countries-visited-fill')) {
            this.map.setFilter('countries-visited-fill',
                ['in', ['get', 'name'], ['literal', this.visitedCountryNames]]
            );
        }

        // Update focused country layer
        if (this.focusedCountry) {
            if (this.visitedCountryNames.includes(this.focusedCountry.name)) {
                // Country is now visited — remove the gray focused layer
                if (this.map.getLayer('countries-focused-fill')) {
                    this.map.removeLayer('countries-focused-fill');
                }
            } else {
                // Ensure focused layer exists for unvisited focused country
                if (!this.map.getLayer('countries-focused-fill') && this.map.getSource('world-countries')) {
                    const mapUnvisited = this.getCssVar('--map-unvisited');
                    this.map.addLayer({
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
            }
        }
    }

    /**
     * Update heritage site layers to reflect changes in visitedPOIIds or heritageSites
     */
    private updateHeritageLayers() {
        if (!this.map) return;

        const source = this.map.getSource('heritage-sites');

        // Filter sites based on showOnlyVisitedSites flag
        const sitesToShow = this.showOnlyVisitedSites
            ? this.heritageSites.filter(site => this.visitedPOIIds.includes(site.id_no))
            : this.heritageSites;

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

        if (source) {
            // Source exists — just update its data
            source.setData(geojson);
        } else if (this.heritageSites.length > 0) {
            // Source doesn't exist yet — create it and add layers
            this.addHeritageLayers(geojson);
        }
    }

    /**
     * Switch the map basemap style between dark and light
     */
    private switchMapStyle(isDark: boolean) {
        if (!this.map) return;

        const style = isDark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

        // Save current center/zoom
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();

        // setStyle triggers a full style reload — we need to re-add our layers after
        this.map.setStyle(style);

        this.map.once('styledata', () => {
            // Restore center/zoom (sometimes lost on style change)
            this.map?.setCenter(center);
            this.map?.setZoom(zoom);

            // Re-add all our custom sources and layers
            this.rebuildLayers();
        });
    }

    /**
     * Rebuild all custom sources and layers after a style change
     */
    private rebuildLayers() {
        if (!this.map) return;

        const primaryColor = this.getCssVar('--primary');
        const mapUnvisited = this.getCssVar('--map-unvisited');
        const mapBorder = this.getCssVar('--map-border');
        const mapMarkerMuted = this.getCssVar('--map-marker-muted');

        // Re-add country source
        this.map.addSource('world-countries', {
            type: 'geojson',
            data: '/countries.geojson'
        });

        // Visited countries fill
        this.map.addLayer({
            id: 'countries-visited-fill',
            type: 'fill',
            source: 'world-countries',
            filter: ['in', ['get', 'name'], ['literal', this.visitedCountryNames]],
            paint: {
                'fill-color': primaryColor,
                'fill-opacity': 0.4
            }
        });

        // Focused country fill (if applicable)
        if (this.focusedCountry && !this.visitedCountryNames.includes(this.focusedCountry.name)) {
            this.map.addLayer({
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

        // Country borders
        this.map.addLayer({
            id: 'countries-borders',
            type: 'line',
            source: 'world-countries',
            paint: {
                'line-color': mapBorder,
                'line-opacity': 0.2,
                'line-width': 1
            }
        });

        // Re-add heritage sites
        if (this.heritageSites.length > 0) {
            const sitesToShow = this.showOnlyVisitedSites
                ? this.heritageSites.filter(site => this.visitedPOIIds.includes(site.id_no))
                : this.heritageSites;

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

            this.addHeritageLayers(geojson);
        }

        // Re-add hover tooltip handler
        this.setupHoverTooltip();
    }

    /**
     * Add heritage site source + layers
     */
    private addHeritageLayers(geojson: GeoJSON.FeatureCollection) {
        if (!this.map) return;

        const primaryColor = this.getCssVar('--primary');
        const mapBorder = this.getCssVar('--map-border');
        const mapMarkerMuted = this.getCssVar('--map-marker-muted');

        this.map.addSource('heritage-sites', {
            type: 'geojson',
            data: geojson
        });

        // Unvisited sites (grey)
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

        // Visited sites (teal)
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

    /**
     * Set up the unified hover tooltip handler
     */
    private setupHoverTooltip() {
        if (!this.map || !this.popup) return;

        this.map.on('mousemove', (e: any) => {
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
    }

    private async initializeMap() {
        try {
            const maplibreModule = await import('maplibre-gl');
            this.maplibregl = (maplibreModule as any).default || maplibreModule;

            const center: [number, number] = this.focusedCountry
                ? [this.focusedCountry.longitude, this.focusedCountry.latitude]
                : [0, 20];

            const zoom = this.focusedCountry ? 4 : 1.5;

            const mapStyle = this.themeService.darkMode()
                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

            this.map = new this.maplibregl.Map({
                container: 'map-container',
                style: mapStyle,
                center: center,
                zoom: zoom,
                attributionControl: false
            });

            this.popup = new this.maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'map-hover-popup'
            });

            this.map.on('load', () => {
                this.mapReady = true;

                // Build all layers
                this.rebuildLayers();

                this.isLoading = false;
                this.cdr.detectChanges();
            });

        } catch (error) {
            console.error('Error initializing map:', error);
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private flyToCountry(country: Country) {
        if (this.map && country.latitude && country.longitude) {
            const mapUnvisited = this.getCssVar('--map-unvisited');

            this.map.flyTo({
                center: [country.longitude, country.latitude],
                zoom: 5,
                essential: true
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
                }, 'heritage-sites-unvisited');
            }
        }
    }
}
