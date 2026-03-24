import { Component, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TravelService } from '../../services/travel.service';
import { HashRouterService } from '../../services/hash-router.service';
import { SearchOverlayService } from '../../services/search-overlay.service';
import { Country, UserProfile } from '../../models/travel.model';

interface CountryResult { country: Country; }
interface HeritageResult { site: any; country: Country; }
interface UserResult { user: UserProfile; }

@Component({
    selector: 'app-search-overlay',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './search-overlay.component.html',
    styleUrls: ['./search-overlay.component.css']
})
export class SearchOverlayComponent implements OnInit, OnDestroy {
    query = '';
    allCountries: Country[] = [];
    countryResults: CountryResult[] = [];
    heritageResults: HeritageResult[] = [];
    userResults: UserResult[] = [];
    searching = false;

    private destroy$ = new Subject<void>();
    private searchTimeout: any;

    constructor(
        public searchOverlay: SearchOverlayService,
        private travel: TravelService,
        private hashRouter: HashRouterService,
        private router: Router,
        private elRef: ElementRef,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.travel.getCountries().pipe(takeUntil(this.destroy$)).subscribe(countries => {
            this.allCountries = countries;
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    @HostListener('keydown.escape')
    close() {
        this.searchOverlay.close();
        this.query = '';
        this.clearResults();
    }

    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('search-backdrop')) {
            this.close();
        }
    }

    onQueryChange(val: string) {
        this.query = val;
        clearTimeout(this.searchTimeout);
        if (!val.trim()) { this.clearResults(); this.cdr.markForCheck(); return; }
        this.searchTimeout = setTimeout(() => this.runSearch(val.trim()), 200);
    }

    private async runSearch(q: string) {
        const lower = q.toLowerCase();

        // Countries — synchronous, fast
        this.countryResults = this.allCountries
            .filter(c => c.name.toLowerCase().includes(lower))
            .slice(0, 8)
            .map(country => ({ country }));

        // Heritage sites
        const heritageMatches: HeritageResult[] = [];
        for (const country of this.allCountries) {
            for (const site of (country.worldHeritageSites || [])) {
                if ((site.name_en || '').toLowerCase().includes(lower)) {
                    heritageMatches.push({ site, country });
                }
            }
        }
        this.heritageResults = heritageMatches.slice(0, 6);
        // Trigger CD synchronously so country + heritage results show immediately
        this.cdr.markForCheck();

        // Users — async Firestore query
        this.searching = true;
        try {
            const users = await this.travel.searchUsers(q);
            this.userResults = users.slice(0, 5).map(user => ({ user }));
        } finally {
            this.searching = false;
            // Trigger CD again after async completes (may be outside zone)
            this.cdr.markForCheck();
        }
    }

    private clearResults() {
        this.countryResults = [];
        this.heritageResults = [];
        this.userResults = [];
    }

    get hasResults(): boolean {
        return this.countryResults.length > 0 || this.heritageResults.length > 0 || this.userResults.length > 0;
    }

    selectCountry(country: Country) {
        this.hashRouter.openCountry(country.id);
        this.close();
    }

    selectHeritageSite(result: HeritageResult) {
        this.hashRouter.openCountry(result.country.id);
        this.close();
    }

    selectUser(user: UserProfile) {
        this.router.navigate(['/user', user.username]);
        this.close();
    }

    isOnline(isoTimestamp: string | undefined): boolean {
        if (!isoTimestamp) return false;
        return Date.now() - new Date(isoTimestamp).getTime() < 5 * 60 * 1000;
    }
}
