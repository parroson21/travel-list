import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile, Continent, POI } from '../../models/travel.model';
import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

interface CountryGroup {
  continent: string;
  countries: Country[];
}

interface POIGroup {
  continent: string;
  pois: POI[];
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
  activeTab: 'countries' | 'pois' = 'countries';
  searchQuery = '';
  selectedContinent = '';
  private searchSubject = new BehaviorSubject<string>('');
  private continentSubject = new BehaviorSubject<string>('');

  vm$: Observable<{
    countryGroups: CountryGroup[],
    poiGroups: POIGroup[],
    continents: Continent[],
    profile: UserProfile | null
  }> | undefined;

  constructor(private travel: TravelService) { }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getPOIs(),
      this.travel.getContinents(),
      this.searchSubject,
      this.continentSubject,
      this.travel.getUserProfile().pipe(startWith(null))
    ]).pipe(
      map(([countries, pois, continents, query, selectedContinent, profile]) => {
        const q = query.toLowerCase();

        // Filter countries by search query
        let filteredCountries = countries.filter(c => (c.name || '').toLowerCase().includes(q));

        // Filter countries by continent if selected
        if (selectedContinent) {
          filteredCountries = filteredCountries.filter(c => c.region === selectedContinent);
        }

        // Group countries by continent
        const countryMap = new Map<string, Country[]>();
        filteredCountries.forEach(country => {
          const continent = country.region || 'Unknown';
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

        // Filter POIs by search query
        let filteredPOIs = pois.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.country || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );

        // Filter POIs by continent if selected
        if (selectedContinent) {
          filteredPOIs = filteredPOIs.filter(p => p.region === selectedContinent);
        }

        // Group POIs by continent
        const poiMap = new Map<string, POI[]>();
        filteredPOIs.forEach(poi => {
          const continent = poi.region || 'Unknown';
          if (!poiMap.has(continent)) {
            poiMap.set(continent, []);
          }
          poiMap.get(continent)!.push(poi);
        });

        const poiGroups: POIGroup[] = Array.from(poiMap.keys())
          .sort()
          .map(continent => ({
            continent,
            pois: poiMap.get(continent)!.sort((a, b) =>
              (a.name || '').localeCompare(b.name || '')
            )
          }));

        return {
          countryGroups,
          poiGroups,
          continents,
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

  isCountryVisited(countryId: string, profile: UserProfile | null): boolean {
    return profile?.visitedCountries?.includes(countryId) || false;
  }

  isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
    return profile?.visitedPOIs?.includes(poiId) || false;
  }

  toggleCountryVisited(countryId: string, profile: UserProfile | null) {
    const visited = this.isCountryVisited(countryId, profile);
    this.travel.markCountryVisited(countryId, !visited);
  }

  togglePOIVisited(poiId: string, profile: UserProfile | null) {
    const visited = this.isPOIVisited(poiId, profile);
    this.travel.markPOIVisited(poiId, !visited);
  }
}
