import { Component, Input, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import * as maplibregl from 'maplibre-gl';

@Component({
    selector: 'app-world-map',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './world-map.component.html',
    styleUrls: ['./world-map.component.css']
})
export class WorldMapComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() visitedCountryIds: string[] = [];
    @Input() zoomToCountryId: string | null = null;
    @Input() height: string = '500px';
    @Input() heritageSites: any[] = [];
    @Input() visitedPOIIds: string[] = [];
    @Input() showOnlyVisitedSites: boolean = false;

    private map: maplibregl.Map | null = null;
    isLoading = true;
    isBrowser: boolean;

    constructor(
        private router: Router,
        private cdr: ChangeDetectorRef,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    ngOnInit() { }

    ngAfterViewInit() {
        if (this.isBrowser) {
            setTimeout(() => this.initializeMap(), 100);
        }
    }

    ngOnDestroy() {
        if (this.map) {
            this.map.remove();
        }
    }

    private initializeMap() {
        try {
            this.map = new maplibregl.Map({
                container: 'map-container',
                style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
                center: [0, 20],
                zoom: this.zoomToCountryId ? 4 : 1.5,
                attributionControl: false
            });

            this.map.on('load', () => {
                // Add custom country highlighting layer
                if (this.visitedCountryIds.length > 0 && this.map) {
                    // We'll add a simple fill layer for visited countries
                    // This requires the basemap to have a countries layer
                    try {
                        this.map.addLayer({
                            id: 'countries-visited-highlight',
                            type: 'fill',
                            source: 'carto',
                            'source-layer': 'boundaries',
                            filter: ['all',
                                ['==', ['get', 'admin_level'], 0],
                                ['in', ['get', 'iso_a2'], ['literal', this.visitedCountryIds.map(id => id.toUpperCase())]]
                            ],
                            paint: {
                                'fill-color': '#008D8D',
                                'fill-opacity': 0.4
                            }
                        });
                    } catch (e) {
                        console.warn('Could not add visited countries layer:', e);
                    }
                }

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
                                'circle-color': '#6b7280',
                                'circle-stroke-color': '#ffffff',
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
                            'circle-color': '#008D8D',
                            'circle-stroke-color': '#ffffff',
                            'circle-stroke-width': 2,
                            'circle-opacity': 1
                        }
                    });

                    // Add hover effect
                    this.map.on('mouseenter', 'heritage-sites-unvisited', () => {
                        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
                    });
                    this.map.on('mouseleave', 'heritage-sites-unvisited', () => {
                        if (this.map) this.map.getCanvas().style.cursor = '';
                    });
                    this.map.on('mouseenter', 'heritage-sites-visited', () => {
                        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
                    });
                    this.map.on('mouseleave', 'heritage-sites-visited', () => {
                        if (this.map) this.map.getCanvas().style.cursor = '';
                    });
                }

                this.isLoading = false;
                this.cdr.detectChanges(); // Manually trigger change detection

                if (this.zoomToCountryId && this.map) {
                    // Zoom to specific country
                    this.zoomToCountry(this.zoomToCountryId);
                }
            });

        } catch (error) {
            console.error('Error initializing map:', error);
            this.isLoading = false;
            this.cdr.detectChanges(); // Manually trigger change detection
        }
    }

    private zoomToCountry(countryId: string) {
        // This would need actual country bounds data
        // For now, just zoom to a reasonable level
        if (this.map) {
            this.map.setZoom(5);
        }
    }
}
