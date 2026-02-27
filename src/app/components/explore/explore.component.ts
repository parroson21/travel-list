import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Country, UserProfile, Continent } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, firstValueFrom, Subscription } from 'rxjs';
import { map, startWith, take, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

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
  private visitedFilterSubject = new BehaviorSubject<'all' | 'visited' | 'planned' | 'unvisited'>('all');

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinents: string[],
    visitedFilter: 'all' | 'visited' | 'planned' | 'unvisited',
    totalCountries: number,
    profile: UserProfile | null,
    recentCountries: Country[]
  }> | undefined;

  constructor(
    private travel: TravelService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    // 1. Initialize from query params (priority) or Service state
    const params = this.route.snapshot.queryParamMap;
    const hasParams = params.has('q') || params.has('c') || params.has('v');

    const q = hasParams ? (params.get('q') || '') : this.travel.exploreState.searchQuery;
    const c = hasParams
      ? (params.get('c') ? params.get('c')!.split(',').filter(x => x) : [])
      : this.travel.exploreState.selectedContinents;
    const v = hasParams
      ? ((params.get('v') as any) || 'all')
      : this.travel.exploreState.visitedFilter;

    this.searchQuery = q;
    this.searchSubject.next(q);
    this.selectedContinentsSubject.next(c);
    this.visitedFilterSubject.next(['all', 'visited', 'planned', 'unvisited'].includes(v) ? v as any : 'all');

    // Sync subjects back to service state
    this.searchSubject.subscribe(val => this.travel.exploreState.searchQuery = val);
    this.selectedContinentsSubject.subscribe(val => this.travel.exploreState.selectedContinents = val);
    this.visitedFilterSubject.subscribe(val => this.travel.exploreState.visitedFilter = val);

    // 2. Setup VM
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.searchSubject,
      this.selectedContinentsSubject,
      this.visitedFilterSubject,
      this.travel.getUserProfile().pipe(startWith(null))
    ]).pipe(
      map(([countries, continents, query, selectedContinents, visitedFilter, profile]) => {
        const q = query.toLowerCase();
        const visitedIds = new Set(profile?.visitedCountries || []);
        const plannedIds = new Set(profile?.plannedCountries || []);

        // Apply search + status filter
        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));

        if (visitedFilter === 'visited') {
          filteredCountries = filteredCountries.filter(c => visitedIds.has(c.id));
        } else if (visitedFilter === 'planned') {
          filteredCountries = filteredCountries.filter(c => plannedIds.has(c.id));
        } else if (visitedFilter === 'unvisited') {
          filteredCountries = filteredCountries.filter(c => !visitedIds.has(c.id) && !plannedIds.has(c.id));
        }

        // Continent counts (from filtered list, before continent filter)
        const continentCounts = new Map<string, number>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        // Group by continent
        const countryMap = new Map<string, Country[]>();
        const isAllContinents = selectedContinents.length === 0;

        filteredCountries
          .filter(c => isAllContinents || selectedContinents.includes(c.continent || 'Unknown'))
          .forEach(country => {
            const continent = country.continent || 'Unknown';
            if (!countryMap.has(continent)) countryMap.set(continent, []);
            countryMap.get(continent)!.push(country);
          });

        // Remove empty continents if they were explicitly selected but contain no matching countries
        // Actually, the current logic only adds continents that HAVE countries to the countryGroups list based on countryMap keys.

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
          visitedFilter,
          totalCountries: filteredCountries.length,
          profile,
          recentCountries
        };
      })
    );
  }

  private updateUrl() {
    const q = this.searchQuery;
    const c = this.selectedContinentsSubject.getValue().join(',');
    const v = this.visitedFilterSubject.getValue();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q || null,
        c: c || null,
        v: v === 'all' ? null : v
      },
      queryParamsHandling: 'merge',
      replaceUrl: true // Using replaceUrl to avoid cluttering history with every keystroke
    });
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchSubject.next(val);
    this.updateUrl();
  }

  toggleContinent(continent: string) {
    const current = this.selectedContinentsSubject.getValue();

    let updated: string[];
    if (current.length === 0) {
      updated = [continent];
    } else {
      updated = current.includes(continent)
        ? current.filter(c => c !== continent)
        : [...current, continent];
    }

    this.selectedContinentsSubject.next(updated);
    this.updateUrl();
  }

  selectAllContinents() {
    this.selectedContinentsSubject.next([]);
    this.updateUrl();
  }

  clearAllFilters() {
    this.selectedContinentsSubject.next([]);
    this.visitedFilterSubject.next('all');
    this.onSearchChange('');
    // onSearchChange already calls updateUrl
  }

  toggleVisitedOnly() {
    const current = this.visitedFilterSubject.getValue();
    if (current === 'all') {
      this.visitedFilterSubject.next('visited');
    } else if (current === 'visited') {
      this.visitedFilterSubject.next('planned');
    } else if (current === 'planned') {
      this.visitedFilterSubject.next('unvisited');
    } else {
      this.visitedFilterSubject.next('all');
    }
    this.updateUrl();
  }

  isContinentActive(continent: string, selectedContinents: string[]): boolean {
    return selectedContinents.includes(continent);
  }

  isCountryVisited(countryId: string, profile: UserProfile | null): boolean {
    return profile?.visitedCountries?.includes(countryId) || false;
  }

  isCountryPlanned(countryId: string, profile: UserProfile | null): boolean {
    return profile?.plannedCountries?.includes(countryId) || false;
  }

  getCountryStatus(countryId: string, profile: UserProfile | null): 'visited' | 'planned' | 'none' {
    if (profile?.visitedCountries?.includes(countryId)) return 'visited';
    if (profile?.plannedCountries?.includes(countryId)) return 'planned';
    return 'none';
  }

  async cycleCountryStatus(countryId: string, profile: UserProfile | null) {
    const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
    if (!user) {
      this.auth.loginWithGoogle();
      return;
    }
    const current = this.getCountryStatus(countryId, profile);
    const next = current === 'none' ? 'planned' : current === 'planned' ? 'visited' : 'none';
    this.travel.setCountryStatus(countryId, next);
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
