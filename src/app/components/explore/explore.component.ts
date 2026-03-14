import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Country, UserProfile, Continent } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject, firstValueFrom } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { EntryModalComponent } from '../entry-modal/entry-modal.component';

interface CountryGroup {
  continent: string;
  countries: Country[];
}

interface HeritageSiteResult {
  site: any;
  countryId: string;
  countryName: string;
  countryEmoji: string;
}

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, EntryModalComponent],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {

  // ── Search mode ──────────────────────────────────────────
  searchMode: 'countries' | 'heritage' | 'users' = 'countries';
  dropdownOpen = false;

  readonly modeLabels: Record<string, string> = {
    countries: 'Country',
    heritage: 'Heritage Site',
    users: 'User'
  };

  // ── Country search ───────────────────────────────────────
  searchQuery = '';
  filtersOpen = false;
  private searchSubject = new BehaviorSubject<string>('');
  private selectedContinentsSubject = new BehaviorSubject<string[]>([]);
  private visitedFilterSubject = new BehaviorSubject<'all' | 'visited' | 'planned' | 'unvisited'>('all');

  // ── Heritage search ──────────────────────────────────────
  heritageQuery = '';
  heritageResults: HeritageSiteResult[] = [];

  // ── User search ──────────────────────────────────────────
  userQuery = '';
  userResults: UserProfile[] = [];
  userSearching = false;
  userSearchDone = false;
  private userSearchTimeout: any;

  // ── Entry modal ──────────────────────────────────────────
  modalCountry: { id: string; name: string; emoji: string } | null = null;

  vm$: Observable<{
    countryGroups: CountryGroup[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinents: string[],
    visitedFilter: 'all' | 'visited' | 'planned' | 'unvisited',
    totalCountries: number,
    profile: UserProfile | null,
    recentCountries: Country[],
    allCountries: Country[]   // kept for heritage search
  }> | undefined;

  constructor(
    private travel: TravelService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private elRef: ElementRef
  ) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.dropdownOpen && !this.elRef.nativeElement.querySelector('.search-type-btn')?.contains(e.target as Node)) {
      this.dropdownOpen = false;
      this.cdr.markForCheck();
    }
  }

  selectMode(mode: 'countries' | 'heritage' | 'users') {
    this.dropdownOpen = false;
    this.onModeChange(mode);
    this.cdr.markForCheck();
  }

  ngOnInit() {
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

    this.searchSubject.subscribe(val => this.travel.exploreState.searchQuery = val);
    this.selectedContinentsSubject.subscribe(val => this.travel.exploreState.selectedContinents = val);
    this.visitedFilterSubject.subscribe(val => this.travel.exploreState.visitedFilter = val);

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

        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));

        if (visitedFilter === 'visited') {
          filteredCountries = filteredCountries.filter(c => visitedIds.has(c.id));
        } else if (visitedFilter === 'planned') {
          filteredCountries = filteredCountries.filter(c => plannedIds.has(c.id));
        } else if (visitedFilter === 'unvisited') {
          filteredCountries = filteredCountries.filter(c => !visitedIds.has(c.id) && !plannedIds.has(c.id));
        }

        const continentCounts = new Map<string, number>();
        filteredCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        const countryMap = new Map<string, Country[]>();
        const isAllContinents = selectedContinents.length === 0;

        filteredCountries
          .filter(c => isAllContinents || selectedContinents.includes(c.continent || 'Unknown'))
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
              (a.name || '').localeCompare(b.name || ''))
          }));

        const recentIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]') as string[];
        const countryById = new Map(countries.map(c => [c.id, c]));
        const recentCountries = recentIds
          .map(id => countryById.get(id))
          .filter((c): c is Country => !!c);

        return {
          countryGroups, continents, continentCounts, selectedContinents,
          visitedFilter, totalCountries: filteredCountries.length,
          profile, recentCountries,
          allCountries: countries
        };
      })
    );
  }

  // ── Mode switching ───────────────────────────────────────
  onModeChange(mode: 'countries' | 'heritage' | 'users') {
    this.searchMode = mode;
    // Reset search fields for the other modes
    this.heritageQuery = '';
    this.heritageResults = [];
    this.userQuery = '';
    this.userResults = [];
    this.userSearchDone = false;
  }

  // ── Heritage search (client-side, from loaded countries) ─
  onHeritageQueryChange(val: string, allCountries: Country[]) {
    this.heritageQuery = val;
    const q = val.trim().toLowerCase();
    if (!q) {
      this.heritageResults = [];
      return;
    }
    const results: HeritageSiteResult[] = [];
    for (const country of allCountries) {
      for (const site of (country.worldHeritageSites || [])) {
        if ((site.name_en || '').toLowerCase().includes(q)) {
          results.push({
            site,
            countryId: country.id,
            countryName: country.name,
            countryEmoji: country.emoji
          });
        }
      }
    }
    this.heritageResults = results
      .sort((a, b) => a.site.name_en.localeCompare(b.site.name_en))
      .slice(0, 50);
  }

  navigateToCountry(countryId: string) {
    this.router.navigate(['/explore', countryId]);
  }

  // ── User search ──────────────────────────────────────────
  onUserQueryChange(val: string) {
    this.userQuery = val;
    this.userSearchDone = false;
    clearTimeout(this.userSearchTimeout);
    if (!val.trim()) {
      this.userResults = [];
      this.userSearching = false;
      this.cdr.markForCheck();
      return;
    }
    this.userSearching = true;
    this.cdr.markForCheck();
    this.userSearchTimeout = setTimeout(async () => {
      this.userResults = await this.travel.searchUsers(val);
      this.userSearching = false;
      this.userSearchDone = true;
      this.cdr.markForCheck();
    }, 350);
  }

  navigateToUser(username: string) {
    this.router.navigate(['/user', username]);
  }

  // ── Country search helpers ───────────────────────────────
  private updateUrl() {
    const q = this.searchQuery;
    const c = this.selectedContinentsSubject.getValue().join(',');
    const v = this.visitedFilterSubject.getValue();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null, c: c || null, v: v === 'all' ? null : v },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchSubject.next(val);
    this.updateUrl();
  }

  toggleContinent(continent: string) {
    const current = this.selectedContinentsSubject.getValue();
    const updated = current.length === 0
      ? [continent]
      : current.includes(continent)
        ? current.filter(c => c !== continent)
        : [...current, continent];
    this.selectedContinentsSubject.next(updated);
    this.updateUrl();
  }

  selectAllContinents() { this.selectedContinentsSubject.next([]); this.updateUrl(); }

  clearAllFilters() {
    this.selectedContinentsSubject.next([]);
    this.visitedFilterSubject.next('all');
    this.onSearchChange('');
  }

  toggleVisitedOnly() {
    const current = this.visitedFilterSubject.getValue();
    const next = current === 'all' ? 'visited' : current === 'visited' ? 'planned' : current === 'planned' ? 'unvisited' : 'all';
    this.visitedFilterSubject.next(next);
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

  openEntryModal(country: Country, event: Event) {
    event.stopPropagation();
    this.modalCountry = { id: country.id, name: country.name, emoji: country.emoji };
    this.cdr.markForCheck();
  }

  closeModal() {
    this.modalCountry = null;
    this.cdr.markForCheck();
  }

  async ensureLoggedIn(): Promise<boolean> {
    const u = await firstValueFrom(this.auth.user$.pipe(take(1)));
    if (!u) { this.auth.loginWithGoogle(); return false; }
    return true;
  }

  /** Returns true if the ISO timestamp is within the last 5 minutes */
  isOnline(isoTimestamp: string | undefined): boolean {
    if (!isoTimestamp) return false;
    return Date.now() - new Date(isoTimestamp).getTime() < 5 * 60 * 1000;
  }
}

