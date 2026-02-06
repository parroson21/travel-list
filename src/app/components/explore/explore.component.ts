import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile, Continent, POI, Subdivision } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs';
import { map, startWith, switchMap, shareReplay, catchError } from 'rxjs/operators';
import { ContinentFilterComponent } from '../continent-filter/continent-filter.component';

interface CountryGroup {
  continent: string;
  countries: Country[];
}

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ContinentFilterComponent, RouterLink],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {
  searchQuery = '';
  selectedContinent = '';
  private searchSubject = new BehaviorSubject<string>('');
  private continentSubject = new BehaviorSubject<string>('');

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinent: string,
    totalCountries: number,
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

        // Calculate continent counts from all countries (before continent filter)
        const continentCounts = new Map<string, number>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

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
          continentCounts,
          selectedContinent,
          totalCountries: countries.filter(c => (c.name || '').toLowerCase().includes(q)).length,
          profile
        };
      })
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

  selectContinent(continent: string) {
    this.onContinentChange(continent);
  }

  clearFilter() {
    this.onContinentChange('');
  }

  isCountryVisited(countryId: string, profile: UserProfile | null): boolean {
    return profile?.visitedCountries?.includes(countryId) || false;
  }

  toggleCountryVisited(countryId: string, profile: UserProfile | null) {
    const visited = this.isCountryVisited(countryId, profile);
    this.travel.markCountryVisited(countryId, !visited);
  }
}
