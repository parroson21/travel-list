import { Component, OnInit, ChangeDetectionStrategy, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { Country, UserProfile } from '../../models/travel.model';
import { WorldMapComponent } from '../world-map/world-map.component';
import { Location } from '@angular/common';

@Component({
    selector: 'app-user-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, WorldMapComponent, DecimalPipe],
    templateUrl: './user-profile.component.html',
    styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

    @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;

    activeTab: 'countries' | 'planned' | 'heritage' = 'countries';
    notFound = false;

    vm$: Observable<{
        targetProfile: UserProfile | null,
        visitedCountries: Country[],
        visitedCountryNames: string[],
        plannedCountries: Country[],
        plannedCountryNames: string[],
        heritageSites: any[],
        visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
        visitedPOIIds: string[],
        stats: { countriesVisited: number, poisVisited: number, countriesPlanned: number },
        isOwnProfile: boolean
    }> | undefined;

    highlightedCountry: Country | null = null;
    hoveredSiteId: string | null = null;
    selectedSite: any = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private travel: TravelService,
        public auth: AuthService,
        private location: Location,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.vm$ = combineLatest([
            this.route.params.pipe(
                switchMap(async params => {
                    const username = params['username'];
                    const profile = await this.travel.getUserByUsername(username);
                    if (!profile) {
                        this.notFound = true;
                        this.cdr.markForCheck();
                        return null;
                    }
                    this.notFound = false;
                    return profile;
                }),
                switchMap(profile => {
                    if (!profile) return of(null);
                    return this.travel.getUserProfileById(profile.uid);
                })
            ),
            this.travel.getCountries(),
            this.auth.user$.pipe(startWith(null))
        ]).pipe(
            map(([targetProfile, countries, currentUser]) => {
                if (!targetProfile) {
                    return {
                        targetProfile: null,
                        visitedCountries: [],
                        visitedCountryNames: [],
                        plannedCountries: [],
                        plannedCountryNames: [],
                        heritageSites: [],
                        visitedHeritageSites: [],
                        visitedPOIIds: [],
                        stats: { countriesVisited: 0, poisVisited: 0, countriesPlanned: 0 },
                        isOwnProfile: false
                    };
                }

                const visitedCountryIds = targetProfile.visitedCountries || [];
                const plannedCountryIds = targetProfile.plannedCountries || [];
                const visitedPOIIds = targetProfile.visitedPOIs || [];

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

                return {
                    targetProfile,
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
                    isOwnProfile: !!currentUser && currentUser.uid === targetProfile.uid
                };
            })
        );
    }

    setActiveTab(tab: 'countries' | 'planned' | 'heritage') {
        this.activeTab = tab;
        this.selectedSite = null;
    }

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

    navigateToCountry(countryId: string) {
        this.router.navigate(['/explore', countryId]);
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
