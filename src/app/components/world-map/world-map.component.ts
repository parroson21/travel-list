import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, Inject, ChangeDetectorRef, OnChanges, SimpleChanges, effect } from '@angular/core';
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
    @Input() plannedCountryNames: string[] = [];
    @Input() focusedCountry: Country | null = null;
    @Input() height: string = '500px';
    @Input() heritageSites: any[] = [];
    @Input() visitedPOIIds: string[] = [];
    @Input() showOnlyVisitedSites: boolean = false;
    @Input() countryId: string = '';
    @Input() visitedSubdivisionCodes: string[] = [];
    @Input() highlightedSiteId: string | null = null;
    @Input() highlightedSubdivisionCode: string | null = null;

    @Output() poiToggled = new EventEmitter<string>();

    private map: any | null = null;
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
            const palette = this.themeService.selectedPaletteName();

            if (this.map && this.mapReady) {
                // If dark mode toggled, switch style (which calls rebuildLayers)
                // Otherwise just rebuild layers to pick up new colors
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

        if (changes['plannedCountryNames'] && !changes['plannedCountryNames'].firstChange) {
            this.updatePlannedLayer();
        }

        if (changes['visitedSubdivisionCodes'] && !changes['visitedSubdivisionCodes'].firstChange) {
            this.updateRegionalLayers();
        }

        if ((changes['visitedPOIIds'] || changes['heritageSites']) &&
            !(changes['visitedPOIIds']?.firstChange && changes['heritageSites']?.firstChange)) {
            this.updateHeritageLayers();
        }

        if (changes['highlightedSiteId'] && !changes['highlightedSiteId'].firstChange) {
            this.updateSiteHighlight();
        }

        if (changes['highlightedSubdivisionCode'] && !changes['highlightedSubdivisionCode'].firstChange) {
            this.updateSubdivisionHighlight();
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
     * Map a category_short value to a normalized key
     */
    private getCategoryKey(categoryShort: string): string {
        const cat = (categoryShort || '').toUpperCase();
        if (cat === 'C') return 'cultural';
        if (cat === 'N') return 'natural';
        if (cat.includes('C') && cat.includes('N')) return 'mixed';
        return 'cultural'; // default
    }

    /**
     * Build the GeoJSON FeatureCollection from heritage sites
     */
    private buildHeritageGeoJSON(): GeoJSON.FeatureCollection {
        const sitesToShow = this.showOnlyVisitedSites
            ? this.heritageSites.filter(site => this.visitedPOIIds.includes(site.id_no))
            : this.heritageSites;

        return {
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
                        visited: this.visitedPOIIds.includes(site.id_no),
                        category: this.getCategoryKey(site.category_short)
                    }
                }))
        };
    }

    /**
     * Update the planned country layer filter
     */
    private updatePlannedLayer() {
        if (!this.map) return;

        if (this.map.getLayer('countries-planned-fill')) {
            this.map.setFilter('countries-planned-fill',
                ['in', ['get', 'name'], ['literal', this.plannedCountryNames]]
            );
        }
    }

    /**
     * Update visited/focused country layer filters without rebuilding the map
     */
    private updateCountryLayers() {
        if (!this.map) return;

        if (this.map.getLayer('countries-visited-fill')) {
            this.map.setFilter('countries-visited-fill',
                ['in', ['get', 'name'], ['literal', this.visitedCountryNames]]
            );
            // Rebuild the color expression — the match table is keyed on country
            // names, so it must be regenerated whenever the country list changes
            // (e.g. toggling between Visited / Planned mode).
            const primaryColor = this.getCssVar('--primary');
            const fillColorExpression = this.getPrimaryColorExpression(primaryColor);
            this.map.setPaintProperty('countries-visited-fill', 'fill-color', fillColorExpression);
        }

        if (this.focusedCountry) {
            if (this.visitedCountryNames.includes(this.focusedCountry.name)) {
                if (this.map.getLayer('countries-focused-fill')) {
                    this.map.removeLayer('countries-focused-fill');
                }
            } else {
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
     * Update regional subdivision layers to reflect changes in visited subdivisions
     */
    private updateRegionalLayers() {
        if (!this.map || !this.countryId) return;

        const sourceId = `${this.countryId.toLowerCase()}-regions`;
        const visitedFillLayerId = `${sourceId}-visited-fill`;

        // Check if the visited subdivisions layer exists
        if (this.map.getLayer(visitedFillLayerId)) {
            if (this.visitedSubdivisionCodes.length > 0) {
                // Update the filter to match the new visited subdivisions
                this.map.setFilter(visitedFillLayerId,
                    ['in', ['get', 'code'], ['literal', this.visitedSubdivisionCodes]]
                );
            } else {
                // Remove the layer if there are no visited subdivisions
                this.map.removeLayer(visitedFillLayerId);
            }
        } else if (this.visitedSubdivisionCodes.length > 0 && this.map.getSource(sourceId)) {
            // Add the visited subdivisions layer if it doesn't exist but we have visited subdivisions
            const primaryColor = this.getCssVar('--primary');
            const fillColorExpression = this.getPrimaryColorExpression(primaryColor);

            this.map.addLayer({
                id: visitedFillLayerId,
                type: 'fill',
                source: sourceId,
                filter: ['in', ['get', 'code'], ['literal', this.visitedSubdivisionCodes]],
                paint: {
                    'fill-color': fillColorExpression,
                    'fill-opacity': 0.4
                }
            });
        }
    }

    /**
     * Update heritage site layers to reflect changes
     */
    private updateHeritageLayers() {
        if (!this.map) return;

        const source = this.map.getSource('heritage-sites');
        const geojson = this.buildHeritageGeoJSON();

        if (source) {
            source.setData(geojson);
        } else if (this.heritageSites.length > 0) {
            this.addHeritageLayers(geojson);
        }
    }

    /**
     * Fly the map to a specific heritage site by its id_no
     */
    flyToSite(siteIdNo: string) {
        if (!this.map) return;
        const site = this.heritageSites.find(s => s.id_no === siteIdNo);
        if (site && site.longitude && site.latitude) {
            this.map.flyTo({
                center: [site.longitude, site.latitude],
                zoom: 8,
                essential: true
            });
        }
    }

    /**
     * Fly the map to a subdivision by lat/lng
     */
    flyToSubdivision(lat: number, lng: number) {
        if (!this.map) return;
        this.map.flyTo({
            center: [lng, lat],
            zoom: 7,
            essential: true
        });
    }

    /**
     * Highlight (or un-highlight) a heritage site pin
     */
    private updateSiteHighlight() {
        if (!this.map || !this.mapReady) return;

        const highlightLayerId = 'heritage-sites-highlight';
        if (this.map.getLayer(highlightLayerId)) {
            this.map.removeLayer(highlightLayerId);
        }
        if (this.map.getSource('heritage-highlight')) {
            this.map.removeSource('heritage-highlight');
        }

        if (!this.highlightedSiteId) return;

        const site = this.heritageSites.find(s => s.id_no === this.highlightedSiteId);
        if (!site || !site.longitude || !site.latitude) return;

        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
                properties: {}
            }]
        };

        this.map.addSource('heritage-highlight', { type: 'geojson', data: geojson });
        this.map.addLayer({
            id: highlightLayerId,
            type: 'circle',
            source: 'heritage-highlight',
            paint: {
                'circle-radius': 14,
                'circle-color': '#ffffff',
                'circle-opacity': 0.25,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2.5
            }
        });
    }

    /**
     * Highlight (or un-highlight) a subdivision polygon
     */
    private updateSubdivisionHighlight() {
        if (!this.map || !this.mapReady || !this.countryId) return;

        const highlightLayerId = `${this.countryId.toLowerCase()}-regions-highlight`;
        if (this.map.getLayer(highlightLayerId)) {
            this.map.removeLayer(highlightLayerId);
        }

        if (!this.highlightedSubdivisionCode) return;

        const sourceId = `${this.countryId.toLowerCase()}-regions`;
        if (!this.map.getSource(sourceId)) return;

        this.map.addLayer({
            id: highlightLayerId,
            type: 'line',
            source: sourceId,
            filter: ['==', ['get', 'code'], this.highlightedSubdivisionCode],
            paint: {
                'line-color': '#ffffff',
                'line-width': 2.5,
                'line-opacity': 0.9
            }
        });
    }

    private lastIsDark: boolean | null = null;
    /**
     * Switch the map basemap style between dark and light
     */
    private switchMapStyle(isDark: boolean) {
        if (!this.map) return;

        if (this.lastIsDark === isDark) {
            this.rebuildLayers();
            return;
        }
        this.lastIsDark = isDark;

        const style = isDark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

        const center = this.map.getCenter();
        const zoom = this.map.getZoom();

        this.map.setStyle(style);

        this.map.once('styledata', () => {
            this.map?.setCenter(center);
            this.map?.setZoom(zoom);
            this.rebuildLayers();
        });
    }

    /**
     * Attempt to load regional GeoJSON data for a country
     * Returns a FeatureCollection if subdivisions are available, null otherwise
     */
    private async loadRegionalGeoJSON(countryCode: string): Promise<any | null> {
        try {
            // Try common subdivision folder names
            const subdivisionTypes = ['regions', 'prefectures', 'provinces', 'states', 'counties'];

            for (const subdivType of subdivisionTypes) {
                try {
                    // Try to fetch the manifest file for this subdivision type
                    const manifestResponse = await fetch(`/geojson/${countryCode}/${subdivType}/manifest.json`);

                    if (!manifestResponse.ok) {
                        continue; // Try next subdivision type
                    }

                    const manifest = await manifestResponse.json();

                    if (!manifest.regions || !Array.isArray(manifest.regions) || manifest.regions.length === 0) {
                        console.warn(`Manifest for ${countryCode}/${subdivType} has no regions`);
                        continue;
                    }

                    // Load all subdivision GeoJSON files in parallel
                    const subdivisionPromises = manifest.regions.map((code: string) =>
                        fetch(`/geojson/${countryCode}/${subdivType}/${code}.geojson`)
                            .then(r => {
                                if (!r.ok) throw new Error(`Failed to load ${code}`);
                                return r.json();
                            })
                            .catch(err => {
                                console.warn(`Failed to load subdivision ${code}:`, err);
                                return null;
                            })
                    );

                    const subdivisions = await Promise.all(subdivisionPromises);

                    // Filter out any failed loads and combine features
                    const validSubdivisions = subdivisions.filter(r => r !== null);

                    if (validSubdivisions.length === 0) {
                        console.warn(`No valid subdivisions loaded for ${countryCode}/${subdivType}`);
                        continue;
                    }

                    const combinedFeatures = validSubdivisions.flatMap(subdivision => subdivision.features || []);

                    return {
                        type: 'FeatureCollection',
                        features: combinedFeatures
                    };
                } catch (error) {
                    // Try next subdivision type
                    continue;
                }
            }

            // No subdivision data found for any type
            return null;

        } catch (error) {
            // Silently fail - this is expected for countries without regional data
            return null;
        }
    }

    /**
     * Rebuild all custom sources and layers after a style change
     */
    private async rebuildLayers() {
        if (!this.map) return;
        this.clearLayers();

        const primaryColor = this.getCssVar('--primary');
        const mapUnvisited = this.getCssVar('--map-unvisited');
        const mapBorder = this.getCssVar('--map-border');

        // Try to load regional subdivisions if viewing a specific country
        if (this.focusedCountry && this.countryId) {
            const regionalData = await this.loadRegionalGeoJSON(this.countryId);

            if (regionalData) {
                // Regional data available - display regions
                const sourceId = `${this.countryId.toLowerCase()}-regions`;
                const bordersLayerId = `${sourceId}-borders`;
                const fillLayerId = `${sourceId}-fill`;

                this.map.addSource(sourceId, {
                    type: 'geojson',
                    data: regionalData
                });

                // Add region borders
                this.map.addLayer({
                    id: bordersLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': mapBorder,
                        'line-opacity': 0.5,
                        'line-width': 2
                    }
                });

                // Add region fills (unvisited regions)
                this.map.addLayer({
                    id: fillLayerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': mapUnvisited,
                        'fill-opacity': 0.1
                    }
                });

                // Add visited subdivisions layer
                if (this.visitedSubdivisionCodes.length > 0) {
                    const visitedFillLayerId = `${sourceId}-visited-fill`;
                    const fillColorExpression = this.getPrimaryColorExpression(primaryColor);

                    this.map.addLayer({
                        id: visitedFillLayerId,
                        type: 'fill',
                        source: sourceId,
                        filter: ['in', ['get', 'code'], ['literal', this.visitedSubdivisionCodes]],
                        paint: {
                            'fill-color': fillColorExpression,
                            'fill-opacity': 0.4
                        }
                    });
                }
            } else {
                // No regional data - fall back to country-level display
                this.addCountryLayers(primaryColor, mapUnvisited, mapBorder);
            }
        } else {
            // No focused country - regular country-level display
            this.addCountryLayers(primaryColor, mapUnvisited, mapBorder);
        }

        // Heritage sites
        if (this.heritageSites.length > 0) {
            const geojson = this.buildHeritageGeoJSON();
            this.addHeritageLayers(geojson);
        }

        // Re-add interactions
        this.setupHoverTooltip();
        this.setupClickHandler();
    }

    private clearLayers() {
        if (!this.map) return;

        const layersToRemove = [
            'countries-visited-fill',
            'countries-planned-fill',
            'countries-focused-fill',
            'countries-borders',
            'heritage-sites-visited',
            'heritage-sites-unvisited',
            'heritage-sites-highlight'
        ];

        // Add dynamic region layers to removal list
        if (this.countryId) {
            const sourceId = `${this.countryId.toLowerCase()}-regions`;
            layersToRemove.push(
                `${sourceId}-borders`,
                `${sourceId}-fill`,
                `${sourceId}-visited-fill`,
                `${sourceId}-highlight`
            );
        }

        layersToRemove.forEach(layer => {
            if (this.map.getLayer(layer)) this.map.removeLayer(layer);
        });

        const sourcesToRemove = ['world-countries', 'heritage-sites', 'heritage-highlight'];
        if (this.countryId) {
            sourcesToRemove.push(`${this.countryId.toLowerCase()}-regions`);
        }

        sourcesToRemove.forEach(source => {
            if (this.map.getSource(source)) this.map.removeSource(source);
        });
    }

    /**
     * Add standard country-level layers
     */
    private addCountryLayers(primaryColor: string, mapUnvisited: string, mapBorder: string) {
        if (!this.map) return;

        // Country source
        this.map.addSource('world-countries', {
            type: 'geojson',
            data: '/countries.geojson'
        });

        const fillColorExpression = this.getPrimaryColorExpression(primaryColor);

        // Visited countries fill
        this.map.addLayer({
            id: 'countries-visited-fill',
            type: 'fill',
            source: 'world-countries',
            filter: ['in', ['get', 'name'], ['literal', this.visitedCountryNames]],
            paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.4
            }
        });

        // Planned countries fill — grey with low opacity to indicate intent without clashing
        if (this.plannedCountryNames.length > 0) {
            this.map.addLayer({
                id: 'countries-planned-fill',
                type: 'fill',
                source: 'world-countries',
                filter: ['in', ['get', 'name'], ['literal', this.plannedCountryNames]],
                paint: {
                    'fill-color': '#888888',
                    'fill-opacity': 0.25
                }
            });
        }

        // Focused country fill
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
    }

    private getPrimaryColorExpression(defaultColor: string): any {
        const colorsStr = this.getCssVar('--primary-colors');
        if (!colorsStr) return defaultColor;

        const colors = colorsStr.split(',').map(c => c.trim());
        if (colors.length <= 1) return defaultColor;

        // Build a concrete match expression mapping each visited country/subdivision
        // to a color, using a hash of the name to distribute colors evenly.
        const names = this.visitedCountryNames.length > 0
            ? this.visitedCountryNames
            : this.visitedSubdivisionCodes;

        if (names.length === 0) return defaultColor;

        // Simple string hash: sum of char codes * prime
        const hashName = (s: string): number => {
            let h = 0;
            for (let i = 0; i < s.length; i++) {
                h = (h * 31 + s.charCodeAt(i)) | 0;
            }
            return Math.abs(h);
        };

        // Use 'name' property for countries, 'code' for subdivisions
        const prop = this.visitedCountryNames.length > 0 ? 'name' : 'code';

        const matchArgs: any[] = ['match', ['get', prop]];
        names.forEach((name) => {
            matchArgs.push(name, colors[hashName(name) % colors.length]);
        });
        matchArgs.push(defaultColor);

        return matchArgs;
    }

    /**
     * Get a single colour for a heritage site category (used in tooltips).
     * Reads from --heritage-* CSS variables set by the theme service.
     */
    private getHeritagePinColor(category?: string): string {
        if (category === 'natural') return this.getCssVar('--heritage-natural') || '#27ae60';
        if (category === 'mixed')   return this.getCssVar('--heritage-mixed')   || '#E67E22';
        return this.getCssVar('--heritage-cultural') || '#4a90d9'; // cultural + default
    }

    /**
     * MapLibre paint expression using --heritage-* CSS variables.
     * Fully independent of --primary / --secondary.
     */
    private getHeritagePinColorExpression(): any {
        const cultural = this.getCssVar('--heritage-cultural') || '#4a90d9';
        const natural  = this.getCssVar('--heritage-natural')  || '#27ae60';
        const mixed    = this.getCssVar('--heritage-mixed')    || '#E67E22';

        return [
            'match',
            ['get', 'category'],
            'cultural', cultural,
            'natural',  natural,
            'mixed',    mixed,
            cultural  // default fallback
        ];
    }

    /**
     * Add heritage site source + layers with category-based colors
     */
    private addHeritageLayers(geojson: GeoJSON.FeatureCollection) {
        if (!this.map) return;

        const mapBorder = this.getCssVar('--map-border');
        const colorExpr = this.getHeritagePinColorExpression();

        this.map.addSource('heritage-sites', {
            type: 'geojson',
            data: geojson
        });

        // Unvisited sites — category colored but muted
        if (!this.showOnlyVisitedSites) {
            this.map.addLayer({
                id: 'heritage-sites-unvisited',
                type: 'circle',
                source: 'heritage-sites',
                filter: ['!', ['get', 'visited']],
                paint: {
                    'circle-radius': 5,
                    'circle-color': colorExpr,
                    'circle-stroke-color': mapBorder,
                    'circle-stroke-width': 1,
                    'circle-opacity': 0.5
                }
            });
        }

        // Visited sites — category colored, full opacity, larger
        this.map.addLayer({
            id: 'heritage-sites-visited',
            type: 'circle',
            source: 'heritage-sites',
            filter: ['get', 'visited'],
            paint: {
                'circle-radius': 7,
                'circle-color': colorExpr,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 1
            }
        });
    }

    /**
     * Hover tooltip — heritage sites take priority over country fills
     */
    private setupHoverTooltip() {
        if (!this.map || !this.popup) return;

        this.map.on('mousemove', (e: any) => {
            if (!this.map || !this.popup) return;

            const heritageLayers: string[] = [];
            if (this.map.getLayer('heritage-sites-visited')) heritageLayers.push('heritage-sites-visited');
            if (this.map.getLayer('heritage-sites-unvisited')) heritageLayers.push('heritage-sites-unvisited');

            const countryLayers: string[] = [];
            if (this.map.getLayer('countries-visited-fill')) countryLayers.push('countries-visited-fill');
            if (this.map.getLayer('countries-focused-fill')) countryLayers.push('countries-focused-fill');

            // Collect region layers dynamically
            const regionLayers: string[] = [];
            if (this.countryId) {
                const sourceId = `${this.countryId.toLowerCase()}-regions`;
                const fillLayerId = `${sourceId}-fill`;
                const visitedFillLayerId = `${sourceId}-visited-fill`;

                if (this.map.getLayer(fillLayerId)) regionLayers.push(fillLayerId);
                if (this.map.getLayer(visitedFillLayerId)) regionLayers.push(visitedFillLayerId);
            }

            // Heritage sites first
            if (heritageLayers.length > 0) {
                const heritageFeatures = this.map.queryRenderedFeatures(e.point, { layers: heritageLayers });
                if (heritageFeatures.length > 0) {
                    this.map.getCanvas().style.cursor = 'pointer';
                    const coords = heritageFeatures[0].geometry.coordinates.slice();
                    const props = heritageFeatures[0].properties;
                    const name = props?.name;
                    const category = props?.category;
                    const visited = props?.visited;
                    const color = this.getHeritagePinColor(category);
                    const label = category === 'cultural' ? 'Cultural' : category === 'natural' ? 'Natural' : 'Mixed';
                    const visitedBadge = visited ? ' ✓' : '';

                    if (name) {
                        this.popup.setLngLat(coords).setHTML(
                            `<strong>${name}</strong>${visitedBadge}<br><span style="color:${color}; font-size: 0.85em;">● ${label}</span>`
                        ).addTo(this.map);
                    }
                    return;
                }
            }

            // Regions second (if viewing a focused country with regions)
            if (regionLayers.length > 0) {
                const regionFeatures = this.map.queryRenderedFeatures(e.point, { layers: regionLayers });
                if (regionFeatures.length > 0) {
                    this.map.getCanvas().style.cursor = 'pointer';
                    const props = regionFeatures[0].properties;
                    const name = props?.name;
                    const code = props?.code;
                    const isVisited = this.visitedSubdivisionCodes.includes(code);
                    const visitedBadge = isVisited ? ' ✓' : '';

                    if (name) {
                        this.popup.setLngLat(e.lngLat).setHTML(
                            `<strong>${name}</strong>${visitedBadge}`
                        ).addTo(this.map);
                    }
                    return;
                }
            }

            // Country fills
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

            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        });
    }

    /**
     * Click handler — clicking a heritage site pin emits poiToggled
     */
    private setupClickHandler() {
        if (!this.map) return;

        this.map.on('click', (e: any) => {
            if (!this.map) return;

            const heritageLayers: string[] = [];
            if (this.map.getLayer('heritage-sites-visited')) heritageLayers.push('heritage-sites-visited');
            if (this.map.getLayer('heritage-sites-unvisited')) heritageLayers.push('heritage-sites-unvisited');

            if (heritageLayers.length > 0) {
                const features = this.map.queryRenderedFeatures(e.point, { layers: heritageLayers });
                if (features.length > 0) {
                    const poiId = features[0].properties?.id;
                    if (poiId) {
                        this.poiToggled.emit(poiId);
                    }
                }
            }
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
                }, this.map.getLayer('heritage-sites-unvisited') ? 'heritage-sites-unvisited' : undefined);
            }
        }
    }
}
