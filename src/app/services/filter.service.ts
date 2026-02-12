import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class FilterService {
    private static CONTINENT_KEY = 'selectedContinents';
    private static KEEP_KEY = 'keepContinentSelection';

    private selectedContinentsSubject: BehaviorSubject<string[]>;
    private keepSelectionSubject: BehaviorSubject<boolean>;

    selectedContinents$;
    keepSelection$;

    constructor() {
        const keep = localStorage.getItem(FilterService.KEEP_KEY) === 'true';
        let stored: string[] = [];
        if (keep) {
            try {
                stored = JSON.parse(localStorage.getItem(FilterService.CONTINENT_KEY) || '[]');
            } catch { stored = []; }
        }
        this.keepSelectionSubject = new BehaviorSubject<boolean>(keep);
        this.selectedContinentsSubject = new BehaviorSubject<string[]>(stored);
        this.selectedContinents$ = this.selectedContinentsSubject.asObservable();
        this.keepSelection$ = this.keepSelectionSubject.asObservable();
    }

    get selectedContinents(): string[] {
        return this.selectedContinentsSubject.value;
    }

    get keepSelection(): boolean {
        return this.keepSelectionSubject.value;
    }

    toggleContinent(continent: string) {
        const current = [...this.selectedContinents];
        const index = current.indexOf(continent);
        if (index >= 0) {
            current.splice(index, 1);
        } else {
            current.push(continent);
        }
        this.setContinents(current);
    }

    clearFilter() {
        this.setContinents([]);
    }

    private setContinents(continents: string[]) {
        if (this.keepSelection) {
            localStorage.setItem(FilterService.CONTINENT_KEY, JSON.stringify(continents));
        }
        this.selectedContinentsSubject.next(continents);
    }

    setKeepSelection(keep: boolean) {
        this.keepSelectionSubject.next(keep);
        if (keep) {
            localStorage.setItem(FilterService.KEEP_KEY, 'true');
            localStorage.setItem(FilterService.CONTINENT_KEY, JSON.stringify(this.selectedContinents));
        } else {
            localStorage.removeItem(FilterService.KEEP_KEY);
            localStorage.removeItem(FilterService.CONTINENT_KEY);
        }
    }
}
