import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile, Subdivision } from '../../models/travel.model';
import { Observable, combineLatest } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';

@Component({
    selector: 'app-country-detail',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './country-detail.component.html',
    styleUrls: ['./country-detail.component.css']
})
export class CountryDetailComponent implements OnInit {
    activeTab: 'subdivisions' | 'heritage' = 'subdivisions';

    vm$: Observable<{
        country: Country | null,
        subdivisions: Subdivision[],
        heritageSites: any[],
        profile: UserProfile | null,
        isVisited: boolean
    }> | undefined;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private travel: TravelService
    ) { }

    ngOnInit() {
        this.vm$ = combineLatest([
            this.route.params.pipe(
                switchMap(params => this.travel.getCountries().pipe(
                    map(countries => countries.find(c => c.id === params['countryId']) || null)
                ))
            ),
            this.route.params.pipe(
                switchMap(params => this.travel.getSubdivisions(params['countryId']))
            ),
            this.travel.getUserProfile().pipe(startWith(null))
        ]).pipe(
            map(([country, subdivisions, profile]) => {
                const isVisited = profile?.visitedCountries?.includes(country?.id || '') || false;
                const heritageSites = country?.worldHeritageSites || [];

                return {
                    country,
                    subdivisions: subdivisions.sort((a, b) => a.name.localeCompare(b.name)),
                    heritageSites,
                    profile,
                    isVisited
                };
            })
        );
    }

    setActiveTab(tab: 'subdivisions' | 'heritage') {
        this.activeTab = tab;
    }

    toggleCountryVisited(countryId: string, isVisited: boolean) {
        this.travel.markCountryVisited(countryId, !isVisited);
    }

    isSubdivisionVisited(subdivisionId: string, profile: UserProfile | null): boolean {
        return profile?.visitedSubdivisions?.includes(subdivisionId) || false;
    }

    isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
        return profile?.visitedPOIs?.includes(poiId) || false;
    }

    toggleSubdivisionVisited(subdivisionId: string, profile: UserProfile | null) {
        this.travel.toggleSubdivisionVisited(subdivisionId, profile);
    }

    togglePOIVisited(poiId: string, profile: UserProfile | null) {
        const visited = this.isPOIVisited(poiId, profile);
        this.travel.markPOIVisited(poiId, !visited);
    }

    goBack() {
        this.router.navigate(['/explore']);
    }
}
