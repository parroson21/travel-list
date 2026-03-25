import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HashRouterService implements OnDestroy {

    private activeCountryIdSubject = new BehaviorSubject<string | null>(null);
    activeCountryId$: Observable<string | null> = this.activeCountryIdSubject.asObservable();

    private boundHandler = this.onHashChange.bind(this);

    constructor(private zone: NgZone) {
        // Parse hash on service init (handles page refresh with hash present)
        this.parseHash();
        window.addEventListener('hashchange', this.boundHandler);
    }

    ngOnDestroy() {
        window.removeEventListener('hashchange', this.boundHandler);
    }

    openCountry(countryId: string): void {
        window.location.hash = `country/${countryId}`;
        // Emit directly so the overlay opens synchronously — don't wait for
        // the async hashchange event which can lag behind Angular's zone.
        this.zone.run(() => this.activeCountryIdSubject.next(countryId));
        document.body.style.overflow = 'hidden';
    }

    closeCountry(): void {
        // Remove hash without adding a history entry
        history.pushState(null, '', window.location.pathname + window.location.search);
        this.zone.run(() => this.activeCountryIdSubject.next(null));
        document.body.style.overflow = '';
    }

    private onHashChange(): void {
        this.zone.run(() => this.parseHash());
    }

    private parseHash(): void {
        const hash = window.location.hash; // e.g. "#country/FR"
        const match = hash.match(/^#country\/([A-Z]{2})$/i);
        const id = match ? match[1].toUpperCase() : null;
        this.activeCountryIdSubject.next(id);
        // Sync scroll lock with hash state (handles page refresh with hash)
        document.body.style.overflow = id ? 'hidden' : '';
    }
}
