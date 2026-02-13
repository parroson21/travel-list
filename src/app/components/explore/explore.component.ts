import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { FilterService } from '../../services/filter.service';
import { Country, UserProfile, Continent, POI, Subdivision } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { map, startWith, switchMap, shareReplay, catchError, take } from 'rxjs/operators';
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
  private searchSubject = new BehaviorSubject<string>('');

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinents: string[],
    totalCountries: number,
    profile: UserProfile | null
  }> | undefined;

  constructor(private travel: TravelService, private auth: AuthService, private filterService: FilterService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.searchSubject,
      this.filterService.selectedContinents$,
      this.travel.getUserProfile().pipe(startWith(null))
    ]).pipe(
      map(([countries, continents, query, selectedContinents, profile]) => {
        const q = query.toLowerCase();

        // Filter countries by search query
        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));

        // Calculate continent counts from all countries (before continent filter)
        const continentCounts = new Map<string, number>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        // Filter countries by selected continents
        if (selectedContinents.length > 0) {
          filteredCountries = filteredCountries.filter(c => selectedContinents.includes(c.continent));
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
          selectedContinents,
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

  toggleContinent(continent: string) {
    this.filterService.toggleContinent(continent);
  }

  clearFilter() {
    this.filterService.clearFilter();
  }

  isCountryVisited(countryId: string, profile: UserProfile | null): boolean {
    return profile?.visitedCountries?.includes(countryId) || false;
  }

  async toggleCountryVisited(countryId: string, profile: UserProfile | null) {
    const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
    if (!user) {
      this.auth.loginWithGoogle();
      return;
    }
    const visited = this.isCountryVisited(countryId, profile);
    this.travel.markCountryVisited(countryId, !visited);
  }
}
