import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Country, UserProfile, Continent } from '../../models/travel.model';
import { ContinentFilterComponent } from '../continent-filter/continent-filter.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ContinentFilterComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
  private selectedContinentSubject = new BehaviorSubject<string>('');

  vm$: Observable<{
    visitedCountries: Country[],
    continents: Continent[],
    continentCounts: Map<string, number>,
    selectedContinent: string,
    stats: { countriesVisited: number, poisVisited: number },
    profile: UserProfile | null
  }> | undefined;

  constructor(public travel: TravelService, public auth: AuthService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getContinents(),
      this.travel.getUserProfile().pipe(startWith(null)),
      this.selectedContinentSubject
    ]).pipe(
      map(([countries, continents, profile, selectedContinent]) => {
        // Filter to only visited countries
        const visitedCountryIds = profile?.visitedCountries || [];
        const allVisitedCountries = countries.filter(c => visitedCountryIds.includes(c.id));

        // Calculate counts per continent
        const continentCounts = new Map<string, number>();
        allVisitedCountries.forEach(country => {
          const continent = country.continent || 'Unknown';
          continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
        });

        // Filter by continent if selected
        let visitedCountries = allVisitedCountries;
        if (selectedContinent) {
          visitedCountries = visitedCountries.filter(c => c.continent === selectedContinent);
        }

        // Sort alphabetically
        visitedCountries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const stats = {
          countriesVisited: profile?.visitedCountries?.length || 0,
          poisVisited: profile?.visitedPOIs?.length || 0
        };

        return {
          visitedCountries,
          continents,
          continentCounts,
          selectedContinent,
          stats,
          profile
        };
      })
    );
  }

  selectContinent(continent: string) {
    this.selectedContinentSubject.next(continent);
  }

  clearFilter() {
    this.selectedContinentSubject.next('');
  }
}
