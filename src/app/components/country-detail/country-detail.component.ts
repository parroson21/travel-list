import { Component, OnInit, OnDestroy, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Country, UserProfile, Subdivision, TravelEntry } from '../../models/travel.model';
import { Observable, combineLatest, Subject } from 'rxjs';
import { map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { WorldMapComponent } from '../world-map/world-map.component';
import { HashRouterService } from '../../services/hash-router.service';
import { AddEntryComponent } from '../add-entry/add-entry.component';

interface SubdivisionGroup {
    divisionType: string;
    label: string;
    subdivisions: Subdivision[];
}

@Component({
    selector: 'app-country-overlay',
    standalone: true,
    imports: [CommonModule, WorldMapComponent, AddEntryComponent],
    templateUrl: './country-detail.component.html',
    styleUrls: ['./country-detail.component.css']
})
export class CountryOverlayComponent implements OnInit, OnDestroy {
    @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;

    activeTab: 'subdivisions' | 'heritage' = 'subdivisions';
    infoExpanded = false;
    selectedSite: any = null;
    hoveredSiteId: string | null = null;
    hoveredSubdivisionCode: string | null = null;

    // AddEntry wizard
    addEntryOpen = false;
    addEntryCountry: { id: string; name: string; emoji: string } | null = null;

    vm$: Observable<{
        country: Country | null,
        subdivisionGroups: SubdivisionGroup[],
        totalSubdivisions: number,
        heritageSites: any[],
        profile: UserProfile | null,
        visitedSubdivisions: string[],
        visitedHeritageSiteIds: string[],
        isLoggedIn: boolean
    }> | undefined;

    private destroy$ = new Subject<void>();

    constructor(
        private travel: TravelService,
        private auth: AuthService,
        public hashRouter: HashRouterService
    ) {}

    ngOnInit() {
        this.vm$ = combineLatest([
            this.hashRouter.activeCountryId$.pipe(
                switchMap(id => id
                    ? this.travel.getCountries().pipe(map(cs => cs.find(c => c.id === id) || null))
                    : [null]
                )
            ),
            this.hashRouter.activeCountryId$.pipe(
                switchMap(id => id
                    ? this.travel.getSubdivisions(id)
                    : [[]]
                )
            ),
            this.travel.getUserProfile().pipe(startWith(null)),
            this.auth.user$,
            // Stream entries to derive visited subdivisions/heritage from entry data
            this.travel.getUserProfile().pipe(
                startWith(null),
                switchMap(profile => profile?.uid
                    ? this.travel.getTravelEntries(profile.uid)
                    : [[]]
                )
            )
        ]).pipe(
            map(([country, subdivisions, profile, user, entries]) => {
                const grouped = new Map<string, Subdivision[]>();
                for (const sub of subdivisions) {
                    const type = sub.division || 'other';
                    if (!grouped.has(type)) grouped.set(type, []);
                    grouped.get(type)!.push(sub);
                }
                const subdivisionGroups: SubdivisionGroup[] = Array.from(grouped.entries()).map(([type, subs]) => ({
                    divisionType: type,
                    label: this.pluralizeDivisionType(type),
                    subdivisions: subs.sort((a, b) => a.name.localeCompare(b.name))
                }));

                // Derive visited state from entries (read-only country page)
                const countryEntries = entries.filter(e => e.countryId === country?.id);
                const visitedSubdivisions = [...new Set(countryEntries.flatMap(e => e.subdivisions || []))];
                const visitedHeritageSiteIds = [...new Set(countryEntries.flatMap(e => e.heritageSites || []))];

                return {
                    country,
                    subdivisionGroups,
                    totalSubdivisions: subdivisions.length,
                    heritageSites: country?.worldHeritageSites || [],
                    profile,
                    visitedSubdivisions,
                    visitedHeritageSiteIds,
                    isLoggedIn: !!user
                };
            })
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    close() {
        this.hashRouter.closeCountry();
        this.addEntryOpen = false;
        this.selectedSite = null;
    }

    setActiveTab(tab: 'subdivisions' | 'heritage') {
        this.activeTab = tab;
        this.selectedSite = null;
    }

    openAddEntry(country: Country | null) {
        if (!country) return;
        this.addEntryCountry = { id: country.id, name: country.name, emoji: country.emoji };
        this.addEntryOpen = true;
    }

    closeAddEntry() {
        this.addEntryOpen = false;
        this.addEntryCountry = null;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.selectedSite) {
            const target = event.target as HTMLElement;
            const inDetail = target.closest('.inline-detail');
            const inCard = target.closest('.heritage-card');
            const inMap = target.closest('.country-map-section');
            if (!inDetail && !inCard && !inMap) this.closeSiteDetails();
        }
    }

    focusSubdivision(subdivision: any) {
        this.hoveredSubdivisionCode = subdivision.code;
        if (subdivision.lat && subdivision.lng && this.worldMap) {
            this.worldMap.flyToSubdivision(subdivision.lat, subdivision.lng);
        }
    }

    openSiteDetails(site: any) {
        this.selectedSite = site;
        this.activeTab = 'heritage';
        if (this.worldMap) this.worldMap.flyToSite(site.id_no);
    }

    navigateSite(direction: 1 | -1, heritageSites: any[]) {
        if (!this.selectedSite || heritageSites.length === 0) return;
        const idx = heritageSites.findIndex(s => s.id_no === this.selectedSite.id_no);
        const next = (idx + direction + heritageSites.length) % heritageSites.length;
        this.openSiteDetails(heritageSites[next]);
    }

    getSiteIndex(heritageSites: any[]): number {
        if (!this.selectedSite) return 0;
        return heritageSites.findIndex(s => s.id_no === this.selectedSite.id_no);
    }

    openSiteFromPin(poiId: string, heritageSites: any[]) {
        const site = heritageSites.find(s => s.id_no === poiId);
        if (site) this.openSiteDetails(site);
    }

    closeSiteDetails() { this.selectedSite = null; }
    setSiteHover(siteId: string | null) { this.hoveredSiteId = siteId; }
    setSubdivisionHover(code: string | null) { this.hoveredSubdivisionCode = code; }

    getCountryStatus(countryId: string, profile: UserProfile | null): 'visited' | 'planned' | 'none' {
        if (profile?.visitedCountries?.includes(countryId)) return 'visited';
        if (profile?.plannedCountries?.includes(countryId)) return 'planned';
        return 'none';
    }

    private pluralizeDivisionType(type: string): string {
        const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
        if (type.endsWith('y') && !type.endsWith('ey') && !type.endsWith('ay') && !type.endsWith('oy')) {
            return capitalized.slice(0, -1) + 'ies';
        }
        if (type.endsWith('sh') || type.endsWith('ch') || type.endsWith('ss') || type.endsWith('x')) {
            return capitalized + 'es';
        }
        return capitalized + 's';
    }
}
