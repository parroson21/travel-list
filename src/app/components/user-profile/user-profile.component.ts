import { Component, OnInit, ChangeDetectionStrategy, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, startWith, take } from 'rxjs/operators';
import { Country, UserProfile, TravelEntry } from '../../models/travel.model';
import { WorldMapComponent } from '../world-map/world-map.component';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { Location } from '@angular/common';
import { ProfileEntryRow } from '../profile/profile.component';
import { HashRouterService } from '../../services/hash-router.service';
import { TimelineComponent } from '../timeline/timeline.component';
import { TimelineItem } from '../../models/timeline.model';
import { mapEntriesToTimeline } from '../timeline/timeline-mapper';

@Component({
    selector: 'app-user-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, WorldMapComponent, DecimalPipe, AddEntryComponent, TimelineComponent],
    templateUrl: './user-profile.component.html',
    styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

    @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;

    activeTab: 'countries' | 'planned' | 'heritage' = 'countries';
    notFound = false;
    /** True only when rendered at /user/:username, false at '/' */
    isUsernameRoute = false;

    vm$: Observable<{
        targetProfile: UserProfile | null,
        currentUser: import('@angular/fire/auth').User | null,
        visitedCountries: Country[],
        visitedCountryNames: string[],
        plannedCountries: Country[],
        plannedCountryNames: string[],
        heritageSites: any[],
        visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
        visitedPOIIds: string[],
        stats: { countriesVisited: number, poisVisited: number, countriesPlanned: number },
        isOwnProfile: boolean,
        travelEntries: TravelEntry[],
        entryByCountryId: Map<string, TravelEntry[]>,
        visitedEntryRows: ProfileEntryRow[],
        plannedEntryRows: ProfileEntryRow[],
        homeCountry: Country | undefined,
        countries: Country[],
        timelineItems: TimelineItem[]
    }> | undefined;

    highlightedCountry: Country | null = null;
    hoveredSiteId: string | null = null;
    selectedSite: any = null;

    // ── Entry modal (edit / remove individual entries) ────────────────────
    editModalEntry: TravelEntry | null = null;
    editModalCountry: { id: string; name: string; emoji: string } | null = null;

    // ── Home country picker ───────────────────────────────────────────────
    homePickerOpen = false;
    homeSearch = '';
    pickerAnchorTop = 0;
    pickerAnchorRight = 0;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private travel: TravelService,
        public auth: AuthService,
        private location: Location,
        private cdr: ChangeDetectorRef,
        public hashRouter: HashRouterService
    ) { }

    ngOnInit() {
        this.vm$ = combineLatest([
            this.route.params.pipe(
                switchMap(async params => {
                    const username = params['username'];
                    this.isUsernameRoute = !!username;
                    if (!username) {
                        // '/' route — sentinel value; next pipe will stream own profile
                        return '__self__' as const;
                    }
                    const profile = await this.travel.getUserByUsername(username);
                    if (!profile) {
                        this.notFound = true;
                        this.cdr.markForCheck();
                        return null;
                    }
                    this.notFound = false;
                    return profile;
                }),
                switchMap(profileOrSelf => {
                    if (profileOrSelf === '__self__') {
                        // Stream the logged-in user's own profile (may be null if not logged in)
                        return this.travel.getUserProfile().pipe(startWith(null));
                    }
                    if (!profileOrSelf) return of(null);
                    return this.travel.getUserProfileById(profileOrSelf.uid);
                })
            ),
            this.travel.getCountries(),
            this.auth.user$.pipe(startWith(null))
        ]).pipe(
            switchMap(([targetProfile, countries, currentUser]) => {
                if (!targetProfile) {
                    return of({
                        targetProfile: null,
                        currentUser,
                        visitedCountries: [],
                        visitedCountryNames: [],
                        plannedCountries: [],
                        plannedCountryNames: [],
                        heritageSites: [],
                        visitedHeritageSites: [],
                        visitedPOIIds: [],
                        stats: { countriesVisited: 0, poisVisited: 0, countriesPlanned: 0 },
                        isOwnProfile: false,
                        travelEntries: [] as TravelEntry[],
                        entryByCountryId: new Map<string, TravelEntry[]>(),
                        visitedEntryRows: [] as ProfileEntryRow[],
                        plannedEntryRows: [] as ProfileEntryRow[],
                        homeCountry: undefined as Country | undefined,
                        countries,
                        timelineItems: [] as TimelineItem[]
                    });
                }

                const visitedCountryIds = targetProfile.visitedCountries || [];
                const plannedCountryIds = targetProfile.plannedCountries || [];
                const visitedPOIIds = targetProfile.visitedPOIs || [];
                const isOwnProfile = !!currentUser && currentUser.uid === targetProfile.uid;

                const visitedCountries = countries
                    .filter(c => visitedCountryIds.includes(c.id))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                const plannedCountries = countries
                    .filter(c => plannedCountryIds.includes(c.id))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                const heritageSites = visitedCountries.flatMap(c => c.worldHeritageSites || []);

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

                const countryById = new Map(countries.map(c => [c.id, c]));
                const homeCountry = targetProfile.homeCountryId ? countryById.get(targetProfile.homeCountryId) : undefined;

                return this.travel.getTravelEntries(targetProfile.uid).pipe(
                    map(travelEntries => {
                        const entryByCountryId = new Map<string, TravelEntry[]>();
                        for (const e of travelEntries) {
                            if (!entryByCountryId.has(e.countryId)) entryByCountryId.set(e.countryId, []);
                            entryByCountryId.get(e.countryId)!.push(e);
                        }

                        // Build flat sorted entry row lists (same logic as profile.component.ts)
                        const toRows = (entries: TravelEntry[]): ProfileEntryRow[] => {
                            const dated = entries.filter(e => e.date);
                            const legacy = entries.filter(e => !e.date);
                            dated.sort((a, b) => b.date.localeCompare(a.date));
                            return [
                                ...dated.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: false })),
                                ...legacy.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: true }))
                            ];
                        };

                        // Planned-specific sort: soonest upcoming first, past trips at the bottom, undated last
                        const toPlannedRows = (entries: TravelEntry[]): ProfileEntryRow[] => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dated = entries.filter(e => e.date);
                            const legacy = entries.filter(e => !e.date);
                            const upcoming = dated.filter(e => new Date(e.date) >= today);
                            const past = dated.filter(e => new Date(e.date) < today);
                            upcoming.sort((a, b) => a.date.localeCompare(b.date)); // soonest first
                            past.sort((a, b) => b.date.localeCompare(a.date));     // most recently passed first
                            return [
                                ...upcoming.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: false })),
                                ...past.map(e => ({ entry: e, country: countryById.get(e.countryId), legacy: false })),
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
                            targetProfile,
                            currentUser,
                            visitedCountries,
                            visitedCountryNames: visitedCountries.map(c => c.name),
                            plannedCountries,
                            plannedCountryNames: plannedCountries.map(c => c.name),
                            heritageSites,
                            visitedHeritageSites,
                            visitedPOIIds,
                            stats: {
                                countriesVisited: visitedCountryIds.length,
                                poisVisited: visitedPOIIds.length,
                                countriesPlanned: plannedCountryIds.length
                            },
                            isOwnProfile,
                            travelEntries,
                            entryByCountryId,
                            visitedEntryRows: toRows([...visitedEntries, ...phantomVisited]),
                            plannedEntryRows: toPlannedRows([...plannedEntries, ...phantomPlanned]),
                            homeCountry,
                            countries,
                            timelineItems: mapEntriesToTimeline(
                                travelEntries,
                                countryById,
                                targetProfile
                            )
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

    // ── Entry modal ───────────────────────────────────────────────────────
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

    // ── Home country picker ───────────────────────────────────────────────
    openHomePicker(event: Event) {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        this.pickerAnchorTop = rect.bottom + 8;
        this.pickerAnchorRight = window.innerWidth - rect.right;
        this.homePickerOpen = true;
        this.homeSearch = '';
    }

    closeHomePicker() { this.homePickerOpen = false; this.homeSearch = ''; }

    filteredHomeCountries(countries: Country[]): Country[] {
        const q = this.homeSearch.toLowerCase();
        return q ? countries.filter(c => c.name.toLowerCase().includes(q)) : countries;
    }

    async saveHomeCountry(countryId: string | null) {
        await this.travel.setHomeCountry(countryId);
        this.closeHomePicker();
    }

    // ── POI visited toggle (own profile only) ─────────────────────────────
    isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
        return profile?.visitedPOIs?.includes(poiId) || false;
    }

    async togglePOIVisited(poiId: string, profile: UserProfile | null, event?: Event) {
        if (event) event.stopPropagation();
        const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
        if (!user) {
            this.auth.loginWithGoogle();
            return;
        }
        const visited = profile?.visitedPOIs?.includes(poiId) || false;
        this.travel.markPOIVisited(poiId, !visited);
    }

    // ── Map interaction ───────────────────────────────────────────────────
    focusOnMap(country: Country) {
        this.highlightedCountry = country;
    }

    openSiteDetails(site: any) {
        this.selectedSite = site;
        this.activeTab = 'heritage';
        if (this.worldMap) this.worldMap.flyToSite(site.id_no);
    }

    navigateSite(direction: 1 | -1, heritageSites: { site: any; countryName: string; countryEmoji: string }[]) {
        if (!this.selectedSite || heritageSites.length === 0) return;
        const idx = heritageSites.findIndex(h => h.site.id_no === this.selectedSite.id_no);
        const next = (idx + direction + heritageSites.length) % heritageSites.length;
        this.openSiteDetails(heritageSites[next].site);
    }

    getSiteIndex(heritageSites: { site: any; countryName: string; countryEmoji: string }[]): number {
        if (!this.selectedSite) return 0;
        return heritageSites.findIndex(h => h.site.id_no === this.selectedSite.id_no);
    }

    closeSiteDetails() { this.selectedSite = null; }
    setSiteHover(siteId: string | null) { this.hoveredSiteId = siteId; }

    openSiteFromPin(poiId: string, heritageSites: any[]) {
        const site = heritageSites.find(s => s.id_no === poiId);
        if (site) this.openSiteDetails(site);
    }

    /** Returns number of whole calendar days until the given date string (negative = past) */
    daysUntil(dateStr: string | undefined): number | null {
        if (!dateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - today.getTime()) / 86400000);
    }

    /** Returns true if the ISO timestamp is within the last 5 minutes */
    isOnline(isoTimestamp: string | undefined): boolean {
        if (!isoTimestamp) return false;
        return Date.now() - new Date(isoTimestamp).getTime() < 5 * 60 * 1000;
    }

    navigateToCountry(countryId: string) {
        this.hashRouter.openCountry(countryId);
    }

    onMapCountryClicked(name: string, countries: Country[]) {
        const country = countries.find(c => c.name === name);
        if (country) this.hashRouter.openCountry(country.id);
    }

    goBack() { this.location.back(); }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.selectedSite) {
            const target = event.target as HTMLElement;
            if (!target.closest('.inline-detail') && !target.closest('.heritage-card') && !target.closest('.profile-map-section')) {
                this.closeSiteDetails();
            }
        }
    }
}
