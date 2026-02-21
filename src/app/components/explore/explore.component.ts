import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Country, UserProfile, Continent } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, firstValueFrom } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';

interface CountryGroup {
  continent: string;
  countries: Country[];
}

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {
  searchQuery = '';
  filtersOpen = false;
  private searchSubject = new BehaviorSubject<string>('');
  private selectedContinentsSubject = new BehaviorSubject<string[]>([]);
  private showVisitedOnlySubject = new BehaviorSubject<boolean>(false);

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinents: string[],
    showVisitedOnly: boolean,
    totalCountries: number,
    profile: UserProfile | null,
    recentCountries: Country[]
  }> | undefined;

  constructor(private travel: TravelService, private auth: AuthService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.searchSubject,
      this.selectedContinentsSubject,
      this.showVisitedOnlySubject,
      this.travel.getUserProfile().pipe(startWith(null))
    ]).pipe(
      map(([countries, continents, query, selectedContinents, showVisitedOnly, profile]) => {
        // Initialise selectedContinents to all on first load
        if (selectedContinents.length === 0 && continents.length > 0) {
          const allNames = continents.map(c => c.name);
          this.selectedContinentsSubject.next(allNames);
          selectedContinents = allNames;
        }

        const q = query.toLowerCase();
        const visitedIds = new Set(profile?.visitedCountries || []);

        // Apply search + visited filter
        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));
        if (showVisitedOnly) {
          filteredCountries = filteredCountries.filter(c => visitedIds.has(c.id));
        }

        // Continent counts (from filtered list, before continent filter)
        const continentCounts = new Map<string, number>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        // Group by continent, only include selected continents
        const countryMap = new Map<string, Country[]>();
        filteredCountries
          .filter(c => selectedContinents.includes(c.continent || 'Unknown'))
          .forEach(country => {
            const continent = country.continent || 'Unknown';
            if (!countryMap.has(continent)) countryMap.set(continent, []);
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

        const recentIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]') as string[];
        const countryById = new Map(countries.map(c => [c.id, c]));
        const recentCountries = recentIds
          .map(id => countryById.get(id))
          .filter((c): c is Country => !!c);

        return {
          countryGroups,
          continents,
          continentCounts,
          selectedContinents,
          showVisitedOnly,
          totalCountries: filteredCountries.length,
          profile,
          recentCountries
        };
      })
    );
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchSubject.next(val);
  }

  toggleContinent(continent: string) {
    const current = this.selectedContinentsSubject.getValue();
    const updated = current.includes(continent)
      ? current.filter(c => c !== continent)
      : [...current, continent];
    this.selectedContinentsSubject.next(updated);
  }

  selectAllContinents(continents: Continent[]) {
    this.selectedContinentsSubject.next(continents.map(c => c.name));
  }

  toggleVisitedOnly() {
    this.showVisitedOnlySubject.next(!this.showVisitedOnlySubject.getValue());
  }

  isContinentActive(continent: string, selectedContinents: string[]): boolean {
    return selectedContinents.includes(continent);
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
