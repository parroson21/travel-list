import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';
import { Country, UserProfile } from '../../models/travel.model';
import { WorldMapComponent } from '../world-map/world-map.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WorldMapComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  listMode: 'countries' | 'heritage' = 'countries';

  vm$: Observable<{
    visitedCountries: Country[],
    visitedCountryNames: string[],
    heritageSites: any[],
    visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
    visitedPOIIds: string[],
    stats: { countriesVisited: number, poisVisited: number },
    profile: UserProfile | null
  }> | undefined;

  firstName$: Observable<string>;

  constructor(public travel: TravelService, public auth: AuthService, private router: Router) {
    this.firstName$ = this.auth.user$.pipe(
      map(u => u?.displayName ? u.displayName.split(' ')[0] : 'Traveler')
    );
  }

  ngOnInit() {
    this.vm$ = combineLatest([
      this.travel.getCountries(),
      this.travel.getUserProfile().pipe(startWith(null)),
    ]).pipe(
      map(([countries, profile]) => {
        const visitedCountryIds = profile?.visitedCountries || [];
        const visitedCountries = countries
          .filter(c => visitedCountryIds.includes(c.id))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const stats = {
          countriesVisited: profile?.visitedCountries?.length || 0,
          poisVisited: profile?.visitedPOIs?.length || 0
        };

        const heritageSites = visitedCountries
          .flatMap(country => country.worldHeritageSites || []);

        const visitedPOIIds = profile?.visitedPOIs || [];

        // Only visited heritage sites
        const visitedHeritageSites = visitedCountries
          .flatMap(country =>
            (country.worldHeritageSites || [])
              .filter((site: any) => visitedPOIIds.includes(site.id_no))
              .map((site: any) => ({
                site,
                countryName: country.name,
                countryEmoji: country.emoji
              }))
          )
          .sort((a, b) => a.site.name_en.localeCompare(b.site.name_en));

        return {
          visitedCountries,
          visitedCountryNames: visitedCountries.map(c => c.name),
          heritageSites,
          visitedHeritageSites,
          visitedPOIIds,
          stats,
          profile
        };
      })
    );
  }

  setListMode(mode: 'countries' | 'heritage') {
    this.listMode = mode;
  }

  selectedSite: any = null;

  navigateToCountry(countryId: string) {
    this.router.navigate(['/explore', countryId]);
  }

  openSiteDetails(site: any) {
    this.selectedSite = site;
    document.body.style.overflow = 'hidden';
  }

  closeSiteDetails() {
    this.selectedSite = null;
    document.body.style.overflow = 'auto';
  }

  isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
    return profile?.visitedPOIs?.includes(poiId) || false;
  }

  async togglePOIVisited(poiId: string, profile: UserProfile | null) {
    const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
    if (!user) {
      this.auth.loginWithGoogle();
      return;
    }
    const visited = profile?.visitedPOIs?.includes(poiId) || false;
    this.travel.markPOIVisited(poiId, !visited);
  }
}
