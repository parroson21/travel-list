import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile, Subdivision } from '../../models/travel.model';

interface SubdivisionGroup {
    divisionType: string;
    label: string;
    subdivisions: Subdivision[];
}
import { Observable, combineLatest } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { WorldMapComponent } from '../world-map/world-map.component';

@Component({
    selector: 'app-country-detail',
    standalone: true,
    imports: [CommonModule, WorldMapComponent],
    templateUrl: './country-detail.component.html',
    styleUrls: ['./country-detail.component.css']
})
export class CountryDetailComponent implements OnInit {
    activeTab: 'subdivisions' | 'heritage' = 'subdivisions';

    vm$: Observable<{
        country: Country | null,
        subdivisionGroups: SubdivisionGroup[],
        totalSubdivisions: number,
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

                // Group subdivisions by division type
                const grouped = new Map<string, Subdivision[]>();
                for (const sub of subdivisions) {
                    const type = sub.division || 'other';
                    if (!grouped.has(type)) {
                        grouped.set(type, []);
                    }
                    grouped.get(type)!.push(sub);
                }

                const subdivisionGroups: SubdivisionGroup[] = Array.from(grouped.entries()).map(([type, subs]) => ({
                    divisionType: type,
                    label: this.pluralizeDivisionType(type),
                    subdivisions: subs.sort((a, b) => a.name.localeCompare(b.name))
                }));

                return {
                    country,
                    subdivisionGroups,
                    totalSubdivisions: subdivisions.length,
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

    goBack() {
        this.router.navigate(['/explore']);
    }
}
