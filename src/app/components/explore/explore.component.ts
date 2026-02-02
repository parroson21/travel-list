import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelService } from '../../services/travel.service';
import { POI, Country, UserProfile } from '../../models/travel.model';
import { Observable, combineLatest, map, BehaviorSubject } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface CountryGroup {
  country: string;
  pois: POI[];
}

interface RegionGroup {
  region: string;
  countries: CountryGroup[];
}

interface RegionCountries {
  region: string;
  countries: Country[];
}

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container fade-in">
      <header class="explore-header">
        <h1>Discover the <span class="highlight">World</span></h1>
        <div class="search-box glass-panel">
          <input type="text" 
                 [ngModel]="searchQuery" 
                 (ngModelChange)="onSearchChange($event)"
                 placeholder="Search countries or heritage sites...">
        </div>
      </header>

      <div class="tabs">
        <button class="tab-btn" [class.active]="activeTab === 'countries'" (click)="activeTab = 'countries'">Countries</button>
        <button class="tab-btn" [class.active]="activeTab === 'pois'" (click)="activeTab = 'pois'">Heritage Sites</button>
      </div>

      <div class="content-grid" *ngIf="filteredData$ | async as data">
      <div class="results-wrapper" *ngIf="filteredData$ | async as data">
        <div class="content-grid" *ngIf="activeTab === 'countries'">
          <div *ngFor="let group of data.groupedCountries" class="region-section">
             <h2 class="region-header">{{ group.region }}</h2>
             <div class="content-grid">
                <div class="glass-panel card" *ngFor="let country of group.countries">
                    <div class="card-body">
                    <h3>{{ country.name }}</h3>
                    <p>{{ country.id }}</p>
                    </div>
                    <div class="card-footer">
                    <button class="btn" 
                            [class.btn-visited]="isCountryVisited(country.id)" 
                            [class.btn-outline]="!isCountryVisited(country.id)"
                            (click)="toggleCountry(country.id)">
                        {{ isCountryVisited(country.id) ? 'Visited✓' : 'Mark as Visited' }}
                    </button>
                    </div>
                </div>
             </div>
          </div>
        </div>

        <div *ngIf="activeTab === 'pois'" class="pois-wrapper">
          <div *ngFor="let group of data.groupedPOIs" class="region-section">
            <h2 class="region-header">{{ group.region }}</h2>
            <div *ngFor="let cGroup of group.countries" class="country-section">
              <h3 class="country-header">{{ cGroup.country }} <span class="count">({{cGroup.pois.length}})</span></h3>
              <div class="content-grid">
                <div class="glass-panel card poi-card" *ngFor="let poi of cGroup.pois">
                  <div class="card-body">
                    <span class="poi-category">{{ poi.category }}</span>
                    <h3>{{ poi.name }}</h3>
                    <div class="poi-desc" [innerHTML]="poi.description"></div>
                  </div>
                  <div class="card-footer">
                    <button class="btn" 
                            [class.btn-visited]="isPOIVisited(poi.id)" 
                            [class.btn-outline]="!isPOIVisited(poi.id)"
                            (click)="togglePOI(poi.id)">
                      {{ isPOIVisited(poi.id) ? 'Visited✓' : 'Mark as Visited' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .explore-header {
      margin: 3rem 0;
      text-align: center;
    }
    .highlight {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .search-box {
      margin: 2rem auto;
      max-width: 600px;
      padding: 0.5rem 1.5rem;
    }
    .search-box input {
      width: 100%;
      background: transparent;
      border: none;
      color: white;
      padding: 0.75rem 0;
      font-size: 1.1rem;
      outline: none;
    }
    .tabs {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .tab-btn {
      padding: 0.75rem 2rem;
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--text-muted);
      border-radius: 2rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
    }
    .tab-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      padding-bottom: 4rem;
    }
    .card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      transition: transform 0.3s;
    }
    .card:hover {
      transform: translateY(-5px);
    }
    .card-body {
      padding: 1.5rem;
    }
    .card-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--glass-border);
      background: rgba(0,0,0,0.1);
    }
    .poi-category {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--secondary);
      font-weight: 700;
      display: block;
      margin-bottom: 0.5rem;
    }
    .poi-country {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .poi-desc {
      font-size: 0.85rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      color: #cbd5e1;
    }
    .btn-visited {
      background: var(--accent-gradient);
      border-color: transparent;
      color: white;
    }
    .region-header {
      font-size: 2rem;
      color: var(--primary);
      margin: 3rem 0 1.5rem;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 0.5rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .country-header {
      font-size: 1.4rem;
      color: #e2e8f0;
      margin: 2rem 0 1rem;
      padding-left: 1rem;
      border-left: 4px solid var(--secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .count {
        font-size: 0.9rem;
        color: var(--text-muted);
        font-weight: normal;
    }
    .pois-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
  `]
})
export class ExploreComponent implements OnInit {
  activeTab: 'countries' | 'pois' = 'countries';
  searchQuery: string = '';
  private searchSubject = new BehaviorSubject<string>('');
  profile: UserProfile | null = null;
  filteredData$: Observable<{ groupedCountries: RegionCountries[], groupedPOIs: RegionGroup[] }> | undefined;

  constructor(private travel: TravelService) { }

  ngOnInit() {
    this.travel.getUserProfile().subscribe(p => this.profile = p);

    this.filteredData$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getPOIs(),
      this.searchSubject
    ]).pipe(
      map(([allCountries, allPOIs, query]) => {
        const q = query.toLowerCase();

        // Filter and Group Countries
        const filteredCountries = allCountries.filter(c => c.name.toLowerCase().includes(q));
        const countriesMap = new Map<string, Country[]>();
        filteredCountries.forEach(c => {
          const region = c.region || 'Other';
          if (!countriesMap.has(region)) countriesMap.set(region, []);
          countriesMap.get(region)!.push(c);
        });
        const groupedCountries: RegionCountries[] = Array.from(countriesMap.keys()).sort().map(region => ({
          region,
          countries: countriesMap.get(region)!
        }));

        // Filter POIs
        const filteredPOIs = allPOIs.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q) ||
          p.region.toLowerCase().includes(q)
        ).slice(0, 100);

        // Group POIs
        const groupedPOIs: RegionGroup[] = [];
        const regionMap = new Map<string, Map<string, POI[]>>();

        filteredPOIs.forEach(poi => {
          const region = poi.region || 'Other';
          const country = poi.country || 'Unknown';
          if (!regionMap.has(region)) regionMap.set(region, new Map());
          const cMap = regionMap.get(region)!;
          if (!cMap.has(country)) cMap.set(country, []);
          cMap.get(country)!.push(poi);
        });

        const sortedRegions = Array.from(regionMap.keys()).sort();
        sortedRegions.forEach(region => {
          const cMap = regionMap.get(region)!;
          const countries: CountryGroup[] = [];
          const sortedCountries = Array.from(cMap.keys()).sort();
          sortedCountries.forEach(country => {
            countries.push({ country, pois: cMap.get(country)! });
          });
          groupedPOIs.push({ region, countries });
        });

        return {
          groupedCountries,
          groupedPOIs
        };
      })
    );
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  isCountryVisited(id: string): boolean {
    return this.profile?.visitedCountries?.includes(id) || false;
  }

  isPOIVisited(id: string): boolean {
    return this.profile?.visitedPOIs?.includes(id) || false;
  }

  toggleCountry(id: string) {
    const isVisited = this.isCountryVisited(id);
    this.travel.markCountryVisited(id, !isVisited);
  }

  togglePOI(id: string) {
    const isVisited = this.isPOIVisited(id);
    this.travel.markPOIVisited(id, !isVisited);
  }
}
