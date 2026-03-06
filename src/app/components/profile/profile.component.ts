import { Component, OnInit, ChangeDetectionStrategy, ViewChild, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';
import { Country, UserProfile } from '../../models/travel.model';
import { WorldMapComponent } from '../world-map/world-map.component';

@Component({
    selector: 'app-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, WorldMapComponent, DecimalPipe],
    templateUrl: './profile.html',
    styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {

    @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;

    activeTab: 'countries' | 'planned' | 'heritage' = 'countries';

    vm$: Observable<{
        visitedCountries: Country[],
        visitedCountryNames: string[],
        plannedCountries: Country[],
        plannedCountryNames: string[],
        heritageSites: any[],
        visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
        visitedPOIIds: string[],
        stats: { countriesVisited: number, poisVisited: number, countriesPlanned: number },
        profile: UserProfile | null
    }> | undefined;

    constructor(public travel: TravelService, public auth: AuthService, private router: Router) { }

    ngOnInit() {
        this.vm$ = combineLatest([
            this.travel.getCountries(),
            this.travel.getUserProfile().pipe(startWith(null)),
        ]).pipe(
            map(([countries, profile]) => {
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

                return {
                    visitedCountries,
                    visitedCountryNames: visitedCountries.map(c => c.name),
                    plannedCountries,
                    plannedCountryNames: plannedCountries.map(c => c.name),
                    heritageSites,
                    visitedHeritageSites,
                    visitedPOIIds,
                    stats,
                    profile
                };
            })
        );
    }

    setActiveTab(tab: 'countries' | 'planned' | 'heritage') {
        this.activeTab = tab;
        this.selectedSite = null;
    }

    // ── Map interaction ─────────────────────────────────────
    highlightedCountry: Country | null = null;
    hoveredSiteId: string | null = null;
    selectedSite: any = null;

    focusOnMap(country: Country) {
        this.highlightedCountry = country;
    }

    // ── Heritage site detail ─────────────────────────────────
    openSiteDetails(site: any) {
        this.selectedSite = site;
        this.activeTab = 'heritage';
        if (this.worldMap) {
            this.worldMap.flyToSite(site.id_no);
        }
    }

    openSiteFromPin(poiId: string, heritageSites: any[]) {
        const site = heritageSites.find(s => s.id_no === poiId);
        if (site) this.openSiteDetails(site);
    }

    closeSiteDetails() {
        this.selectedSite = null;
    }

    setSiteHover(siteId: string | null) {
        this.hoveredSiteId = siteId;
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

    // ── POI visited toggle ───────────────────────────────────
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

    // ── Navigation ───────────────────────────────────────────
    navigateToCountry(countryId: string) {
        this.router.navigate(['/explore', countryId]);
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
