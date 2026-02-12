import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { FilterService } from '../../services/filter.service';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Country, UserProfile, Continent } from '../../models/travel.model';
import { ContinentFilterComponent } from '../continent-filter/continent-filter.component';
import { WorldMapComponent } from '../world-map/world-map.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ContinentFilterComponent, WorldMapComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  vm$: Observable<{
    visitedCountries: Country[],
    visitedCountryNames: string[],
    heritageSites: any[],
    visitedPOIIds: string[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinents: string[],
    stats: { countriesVisited: number, poisVisited: number },
    profile: UserProfile | null
  }> | undefined;

  constructor(public travel: TravelService, public auth: AuthService, private router: Router, private filterService: FilterService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.travel.getUserProfile().pipe(startWith(null)),
      this.filterService.selectedContinents$
    ]).pipe(
      map(([countries, continents, profile, selectedContinents]) => {
        // Filter to only visited countries
        const visitedCountryIds = profile?.visitedCountries || [];
        const allVisitedCountries = countries.filter(c => visitedCountryIds.includes(c.id));

        // Calculate counts per continent
        const continentCounts = new Map<string, number>();
        allVisitedCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        // Filter by selected continents
        let visitedCountries = allVisitedCountries;
        if (selectedContinents.length > 0) {
          visitedCountries = visitedCountries.filter(c => selectedContinents.includes(c.continent));
        }

        // Sort alphabetically
        visitedCountries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const stats = {
          countriesVisited: profile?.visitedCountries?.length || 0,
          poisVisited: profile?.visitedPOIs?.length || 0
        };

        // Collect all heritage sites from visited countries
        const heritageSites = allVisitedCountries
          .flatMap(country => country.worldHeritageSites || []);

        return {
          visitedCountries,
          visitedCountryNames: allVisitedCountries.map(c => c.name),
          heritageSites,
          visitedPOIIds: profile?.visitedPOIs || [],
          continents,
          continentCounts,
          selectedContinents,
          stats,
          profile
        };
      })
    );
  }

  toggleContinent(continent: string) {
    this.filterService.toggleContinent(continent);
  }

  clearFilter() {
    this.filterService.clearFilter();
  }

  navigateToCountry(countryId: string) {
    this.router.navigate(['/explore', countryId]);
  }
}
