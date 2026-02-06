import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile, Continent, POI, Subdivision } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs';
import { map, startWith, switchMap, shareReplay, catchError } from 'rxjs/operators';

interface CountryGroup {
  continent: string;
  countries: Country[];
}

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {
  searchQuery = '';
  selectedContinent = '';
  expandedCountries = new Set<string>();
  private searchSubject = new BehaviorSubject<string>('');
  private continentSubject = new BehaviorSubject<string>('');
  private expandedCountrySubject = new BehaviorSubject<string | null>(null);

  subdivisions$: Observable<Subdivision[]> | undefined;

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    profile: UserProfile | null
  }> | undefined;

  constructor(private travel: TravelService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.searchSubject,
      this.continentSubject,
      this.travel.getUserProfile().pipe(startWith(null))
    ]).pipe(
      map(([countries, continents, query, selectedContinent, profile]) => {
        const q = query.toLowerCase();

        // Filter countries by search query
        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));

        // Filter countries by continent if selected
        if (selectedContinent) {
          filteredCountries = filteredCountries.filter(c => c.continent === selectedContinent);
        }

        // Group countries by continent
        const countryMap = new Map<string, Country[]>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          if (!countryMap.has(continent)) {
            countryMap.set(continent, []);
          }
          countryMap.get(continent)!.push(country);
        });

        const countryGroups: CountryGroup[] = Array.from(countryMap.keys())
          .sort()
          .map(continent => ({
            continent,
            countries: countryMap.get(continent)!.sort((a, b) =>
              (a.name || '').localeCompare(b.name || '')
            )
          }));

        return {
          countryGroups,
          continents,
          profile
        };
      })
    );

    this.subdivisions$ = this.expandedCountrySubject.pipe(
      switchMap(id => id ? this.travel.getSubdivisions(id) : of([])),
      map(subs => subs.sort((a, b) => a.name.localeCompare(b.name))),
      catchError(err => {
        console.error('Subdivisions stream error:', err);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchSubject.next(val);
  }

  onContinentChange(val: string) {
    this.selectedContinent = val;
    this.continentSubject.next(val);
  }

  isCountryVisited(countryId: string, profile: UserProfile | null): boolean {
    return profile?.visitedCountries?.includes(countryId) || false;
  }

  isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
    return profile?.visitedPOIs?.includes(poiId) || false;
  }

  isSubdivisionVisited(subdivisionId: string, profile: UserProfile | null): boolean {
    return profile?.visitedSubdivisions?.includes(subdivisionId) || false;
  }

  toggleCountryVisited(countryId: string, profile: UserProfile | null) {
    const visited = this.isCountryVisited(countryId, profile);
    this.travel.markCountryVisited(countryId, !visited);
  }

  togglePOIVisited(poiId: string, profile: UserProfile | null) {
    const visited = this.isPOIVisited(poiId, profile);
    this.travel.markPOIVisited(poiId, !visited);
  }

  toggleSubdivisionVisited(subdivisionId: string, profile: UserProfile | null) {
    this.travel.toggleSubdivisionVisited(subdivisionId, profile);
  }

  toggleExpand(countryId: string, profile: UserProfile | null) {
    if (!this.isCountryVisited(countryId, profile)) return;

    if (this.expandedCountries.has(countryId)) {
      this.expandedCountries.delete(countryId);
      this.expandedCountrySubject.next(null);
    } else {
      // Collapse others? User didn't specify, but usually better for grid
      this.expandedCountries.clear();
      this.expandedCountries.add(countryId);
      this.expandedCountrySubject.next(countryId);
    }
  }

  isExpanded(countryId: string): boolean {
    return this.expandedCountries.has(countryId);
  }
}
