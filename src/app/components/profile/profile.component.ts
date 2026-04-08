import { Component, OnInit, ChangeDetectionStrategy, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { map, startWith, switchMap, take } from 'rxjs/operators';
import { Country, UserProfile, TravelEntry } from '../../models/travel.model';
import { WorldMapComponent } from '../world-map/world-map.component';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { HashRouterService } from '../../services/hash-router.service';
import { ProfilePanelComponent } from './profile-panel/profile-panel.component';
import { ProfileStatsComponent } from './profile-stats/profile-stats.component';

export interface ProfileEntryRow {
    entry: TravelEntry;
    country: Country | undefined;
    legacy: boolean; // true when the entry is missing a proper date
}

@Component({
    selector: 'app-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, WorldMapComponent, DecimalPipe, AddEntryComponent, ProfilePanelComponent, ProfileStatsComponent],
    templateUrl: './profile.html',
    styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {

    @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;
    @ViewChild(ProfilePanelComponent) panel?: ProfilePanelComponent;

    activeTab: 'countries' | 'planned' | 'heritage' = 'countries';

    vm$: Observable<{
        countries: Country[],
        visitedCountries: Country[],
        visitedCountryNames: string[],
        plannedCountries: Country[],
        plannedCountryNames: string[],
        heritageSites: any[],
        visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
        visitedPOIIds: string[],
        stats: { countriesVisited: number, poisVisited: number, countriesPlanned: number },
        profile: UserProfile | null,
        travelEntries: TravelEntry[],
        entryByCountryId: Map<string, TravelEntry[]>,
        visitedEntryRows: ProfileEntryRow[],
        plannedEntryRows: ProfileEntryRow[],
        homeCountry: Country | undefined
    }> | undefined;

    constructor(public travel: TravelService, public auth: AuthService, private router: Router, public hashRouter: HashRouterService, private cdr: ChangeDetectorRef) { }

    ngOnInit() {
        this.vm$ = combineLatest([
            this.travel.getCountries(),
            this.travel.getUserProfile().pipe(startWith(null)),
        ]).pipe(
            switchMap(([countries, profile]) => {
                const uid = profile?.uid;
                const entries$ = uid
                    ? this.travel.getTravelEntries(uid)
                    : new Observable<TravelEntry[]>(o => o.next([]));
                return combineLatest([entries$]).pipe(
                    map(([travelEntries]) => {
                        const visitedCountryIds = profile?.visitedCountries || [];
                        const plannedCountryIds = profile?.plannedCountries || [];
                        const visitedCountries = countries
                            .filter(c => visitedCountryIds.includes(c.id))
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        const plannedCountries = countries
                            .filter(c => plannedCountryIds.includes(c.id))
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                        const stats = {
                            countriesVisited: visitedCountryIds.length,
                            poisVisited: profile?.visitedPOIs?.length || 0,
                            countriesPlanned: plannedCountryIds.length
                        };

                        const heritageSites = visitedCountries
                            .flatMap(country => country.worldHeritageSites || []);

                        const visitedPOIIds = profile?.visitedPOIs || [];

                        const visitedHeritageSites = visitedCountries
                            .flatMap(country =>
                                (country.worldHeritageSites || [])
                                    .filter((site: any) => visitedPOIIds.includes(site.id_no))
                                    .map((site: any) => ({
                                        site,
                                        countryName: country.name,
                                        countryEmoji: country.emoji
                                    }))
                            )
                            .sort((a, b) => a.site.name_en.localeCompare(b.site.name_en));

                        // Build entry map keyed by countryId, sorted newest first
                        const entryByCountryId = new Map<string, TravelEntry[]>();
                        for (const e of travelEntries) {
                            if (!entryByCountryId.has(e.countryId)) entryByCountryId.set(e.countryId, []);
                            entryByCountryId.get(e.countryId)!.push(e);
                        }

                        // Build flat sorted entry row lists
                        const countryById = new Map(countries.map(c => [c.id, c]));

                        const toRows = (entries: TravelEntry[]): ProfileEntryRow[] => {
                            const dated = entries.filter(e => e.date);
                            const legacy = entries.filter(e => !e.date);
                            dated.sort((a, b) => b.date.localeCompare(a.date));
                            return [
                                ...dated.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: false })),
                                ...legacy.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: true }))
                            ];
                        };

                        const visitedEntries = travelEntries.filter(e => e.status === 'visited');
                        const plannedEntries = travelEntries.filter(e => e.status === 'planned');

                        const visitedWithEntries = new Set(visitedEntries.map(e => e.countryId));
                        const plannedWithEntries = new Set(plannedEntries.map(e => e.countryId));

                        const makePhantom = (id: string, status: 'visited' | 'planned'): TravelEntry => {
                            const c = countryById.get(id);
                            return { id: `legacy-${status}-${id}`, countryId: id, countryName: c?.name || id, status, date: '', createdAt: '' };
                        };

                        const phantomVisited = visitedCountryIds
                            .filter(id => !visitedWithEntries.has(id))
                            .map(id => makePhantom(id, 'visited'));

                        const phantomPlanned = plannedCountryIds
                            .filter(id => !plannedWithEntries.has(id))
                            .map(id => makePhantom(id, 'planned'));

                        return {
                            countries,
                            visitedCountries,
                            visitedCountryNames: visitedCountries.map(c => c.name),
                            plannedCountries,
                            plannedCountryNames: plannedCountries.map(c => c.name),
                            heritageSites,
                            visitedHeritageSites,
                            visitedPOIIds,
                            stats,
                            profile,
                            travelEntries,
                            entryByCountryId,
                            visitedEntryRows: toRows([...visitedEntries, ...phantomVisited]),
                            plannedEntryRows: toRows([...plannedEntries, ...phantomPlanned]),
                            homeCountry: profile?.homeCountryId ? countryById.get(profile.homeCountryId) : undefined
                        };
                    })
                );
            })
        );
    }

    setActiveTab(tab: 'countries' | 'planned' | 'heritage') {
        this.activeTab = tab;
        this.selectedSite = null;
    }

    // ── Entry modal ─────────────────────────────────────────
    editModalEntry: TravelEntry | null = null;
    editModalCountry: { id: string; name: string; emoji: string } | null = null;

    openEditModal(row: ProfileEntryRow, event: Event) {
        event.stopPropagation();
        this.editModalEntry = row.entry;
        this.editModalCountry = row.country
            ? { id: row.country.id, name: row.country.name, emoji: row.country.emoji }
            : { id: row.entry.countryId, name: row.entry.countryName, emoji: '' };
    }

    closeEditModal() {
        this.editModalEntry = null;
        this.editModalCountry = null;
    }

    // ── Home country picker ──────────────────────────────────
    homePickerOpen = false;
    homeSearch = '';
    pickerAnchorTop = 0;
    pickerAnchorRight = 0;

    openHomePicker(event: Event) {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        this.pickerAnchorTop = rect.bottom + 8;
        this.pickerAnchorRight = window.innerWidth - rect.right;
        this.homePickerOpen = true;
        this.homeSearch = '';
        this.cdr.markForCheck();
    }
    closeHomePicker() { this.homePickerOpen = false; this.homeSearch = ''; this.cdr.markForCheck(); }

    filteredHomeCountries(countries: Country[]): Country[] {
        const q = this.homeSearch.toLowerCase();
        return q ? countries.filter(c => c.name.toLowerCase().includes(q)) : countries;
    }

    async saveHomeCountry(countryId: string | null) {
        await this.travel.setHomeCountry(countryId);
        this.closeHomePicker();
    }

    // ── Map interaction ─────────────────────────────────────
    highlightedCountry: Country | null = null;
    hoveredSiteId: string | null = null;
    selectedSite: any = null;

    focusOnMap(country: Country) {
        this.highlightedCountry = country;
        this.cdr.markForCheck();
    }

    // ── Heritage site detail ─────────────────────────────────
    openSiteFromPin(poiId: string, heritageSites: any[]) {
        const site = heritageSites.find(s => s.id_no === poiId);
        if (site) this.panel?.openSiteDetails(site);
    }

    closeSiteDetails() {
        this.panel?.closeSiteDetails();
    }

    onPanelSiteChange(site: any | null) {
        this.selectedSite = site;
        this.cdr.markForCheck();
    }

    onSiteFlyTo(site: any) {
        if (this.worldMap) this.worldMap.flyToSite(site.id_no);
    }

    onEditRequested(row: ProfileEntryRow) {
        this.editModalEntry = row.entry;
        this.editModalCountry = row.country
            ? { id: row.country.id, name: row.country.name, emoji: row.country.emoji }
            : { id: row.entry.countryId, name: row.entry.countryName, emoji: '' };
        this.cdr.markForCheck();
    }

    setSiteHover(siteId: string | null) {
        this.hoveredSiteId = siteId;
        this.cdr.markForCheck();
    }

    // ── POI visited toggle ───────────────────────────────────
    isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
        return profile?.visitedPOIs?.includes(poiId) || false;
    }

    async togglePOIVisited(poiId: string, profile: UserProfile | null, event?: Event) {
        if (event) event.stopPropagation();
        const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
        if (!user) { this.auth.loginWithGoogle(); return; }
        const visited = profile?.visitedPOIs?.includes(poiId) || false;
        this.travel.markPOIVisited(poiId, !visited);
    }

    // ── Navigation ───────────────────────────────────────────
    navigateToCountry(countryId: string) {
        this.hashRouter.openCountry(countryId);
    }

    onMapCountryClicked(name: string, countries: Country[]) {
        const country = countries.find(c => c.name === name);
        if (country) this.hashRouter.openCountry(country.id);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.selectedSite) {
            const target = event.target as HTMLElement;
            const inDetail = target.closest('.inline-detail');
            const inCard = target.closest('.heritage-card');
            const inMap = target.closest('.profile-map-section');
            if (!inDetail && !inCard && !inMap) {
                this.closeSiteDetails();
            }
        }
    }
}
