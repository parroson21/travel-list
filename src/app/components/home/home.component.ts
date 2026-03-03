import { Component, OnInit, ChangeDetectionStrategy, ViewChild, HostListener } from '@angular/core';
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

  @ViewChild(WorldMapComponent) worldMap?: WorldMapComponent;

  listMode: 'countries' | 'heritage' | 'planned' = 'countries';

  vm$: Observable<{
    visitedCountries: Country[],
    visitedCountryNames: string[],
    plannedCountries: Country[],
    plannedCountryNames: string[],
    heritageSites: any[],
    visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[],
    visitedPOIIds: string[],
    stats: { countriesVisited: number, poisVisited: number, countriesPlanned: number },
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
        const plannedCountryIds = profile?.plannedCountries || [];
        const visitedCountries = countries
          .filter(c => visitedCountryIds.includes(c.id))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const plannedCountries = countries
          .filter(c => plannedCountryIds.includes(c.id))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const stats = {
          countriesVisited: visitedCountryIds.length,
          poisVisited: profile?.visitedPOIs?.length || 0,
          countriesPlanned: plannedCountryIds.length
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
          plannedCountries,
          plannedCountryNames: plannedCountries.map(c => c.name),
          heritageSites,
          visitedHeritageSites,
          visitedPOIIds,
          stats,
          profile
        };
      })
    );
  }

  setListMode(mode: 'countries' | 'heritage' | 'planned') {
    this.listMode = mode;
  }

  highlightedCountry: Country | null = null;
  hoveredSiteId: string | null = null;
  selectedSite: any = null;
  bottomSheetExpanded = false;

  // ── Mobile bottom sheet touch gestures ──────────────────
  private sheetTouchStartY = 0;
  private sheetContentScrollTop = 0;

  onSheetTouchStart(e: TouchEvent) {
    this.sheetTouchStartY = e.touches[0].clientY;
  }

  onSheetTouchEnd(e: TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - this.sheetTouchStartY;
    const threshold = 50;
    if (deltaY < -threshold) {
      this.bottomSheetExpanded = true;
    } else if (deltaY > threshold) {
      if (this.bottomSheetExpanded) {
        if (this.sheetContentScrollTop <= 0) this.bottomSheetExpanded = false;
      } else {
        this.closeSiteDetails();
      }
    }
  }

  onSheetContentScroll(e: Event) {
    this.sheetContentScrollTop = (e.target as HTMLElement).scrollTop;
  }

  focusOnMap(country: Country) {
    this.highlightedCountry = country;
  }

  openSiteDetails(site: any) {
    this.selectedSite = site;
    this.bottomSheetExpanded = false;
    // Fly map to the site
    if (this.worldMap) {
      this.worldMap.flyToSite(site.id_no);
    }
  }

  openSiteFromPin(poiId: string, heritageSites: any[]) {
    const site = heritageSites.find(s => s.id_no === poiId);
    if (site) this.openSiteDetails(site);
  }

  closeSiteDetails() {
    this.selectedSite = null;
    this.bottomSheetExpanded = false;
  }

  setSiteHover(siteId: string | null) {
    this.hoveredSiteId = siteId;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.selectedSite) {
      const target = event.target as HTMLElement;
      const inPanel = target.closest('.home-site-panel');
      const inRow = target.closest('.heritage-row');
      const inMap = target.closest('.map-panel');
      if (!inPanel && !inRow && !inMap) {
        this.closeSiteDetails();
      }
    }
  }

  isPOIVisited(poiId: string, profile: UserProfile | null): boolean {
    return profile?.visitedPOIs?.includes(poiId) || false;
  }

  async togglePOIVisited(poiId: string, profile: UserProfile | null, event?: Event) {
    if (event) event.stopPropagation();
    const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
    if (!user) {
      this.auth.loginWithGoogle();
      return;
    }
    const visited = profile?.visitedPOIs?.includes(poiId) || false;
    this.travel.markPOIVisited(poiId, !visited);
  }

  navigateToCountry(countryId: string) {
    this.router.navigate(['/explore', countryId]);
  }
}
