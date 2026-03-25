import {
    Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Country, TravelEntry, Subdivision } from '../../models/travel.model';
import { firstValueFrom, take } from 'rxjs';
import { HashRouterService } from '../../services/hash-router.service';

interface SubdivisionGroup {
    divisionType: string;
    label: string;
    subdivisions: Subdivision[];
    expanded: boolean;
}

@Component({
    selector: 'app-add-entry',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-entry.component.html',
    styleUrls: ['./add-entry.component.css']
})
export class AddEntryComponent implements OnInit, OnChanges {
    /** Pre-fill country — Stage 1 is skipped when provided */
    @Input() preselectedCountry?: { id: string; name: string; emoji: string };
    /** Provide to enter edit mode */
    @Input() existingEntry?: TravelEntry;

    @Output() saved = new EventEmitter<void>();
    @Output() closed = new EventEmitter<void>();

    // ── Wizard state ────────────────────────────────────────
    stage: 1 | 2 | 3 | 4 = 1;
    readonly TOTAL_STAGES = 4;

    // Stage 1 — Country selection
    allCountries: Country[] = [];
    countrySearch = '';
    selectedCountry: Country | null = null;
    filteredCountries: Country[] = [];

    // Stage 2 — Status & date
    status: 'visited' | 'planned' = 'visited';
    selectedYear: number = new Date().getFullYear();
    selectedMonth: number = 0; // 0 = no month selected
    skipDate = false;

    // Stage 3 — Subdivisions & heritage sites
    subdivisionGroups: SubdivisionGroup[] = [];
    heritageSites: any[] = [];
    selectedSubdivisions: Set<string> = new Set();
    selectedHeritage: Set<string> = new Set();

    // Stage 4 — Note & Rating
    rating: number = 0;
    hoverRating: number = 0;
    note = '';

    saving = false;
    deleting = false;
    error: string | null = null;

    readonly months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    readonly currentYear = new Date().getFullYear();

    get availableYears(): number[] {
        const years: number[] = [];
        for (let y = this.currentYear + 5; y >= 1900; y--) years.push(y);
        return years;
    }

    get maxMonth(): number {
        if (this.status === 'visited' && this.selectedYear === new Date().getFullYear()) {
            return new Date().getMonth() + 1;
        }
        return 12;
    }

    constructor(
        private travel: TravelService,
        private auth: AuthService,
        private hashRouter: HashRouterService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.travel.getCountries().pipe(take(1)).subscribe(countries => {
            this.allCountries = countries;
            this.updateFilteredCountries();
            this.initFromInputs();
            // Firestore may fire outside Angular's zone — force a sync.
            this.cdr.detectChanges();
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['preselectedCountry'] || changes['existingEntry']) {
            // Countries load async — if they aren't ready yet, ngOnInit's
            // subscription will call initFromInputs() once they arrive.
            if (this.allCountries.length === 0) return;
            this.initFromInputs();
        }
    }

    private initFromInputs() {
        if (this.existingEntry) {
            // Edit mode: load values from existing entry
            const entry = this.existingEntry;
            const country = this.allCountries.find(c => c.id === entry.countryId);
            if (country) this.setCountry(country);
            this.status = entry.status;
            if (entry.date) {
                const [y, m] = entry.date.split('-').map(Number);
                if (y) this.selectedYear = y;
                if (m) this.selectedMonth = m;
            }
            this.skipDate = !!entry.needsDate;
            this.note = entry.note || '';
            this.rating = entry.rating || 0;
            entry.subdivisions?.forEach(s => this.selectedSubdivisions.add(s));
            entry.heritageSites?.forEach(h => this.selectedHeritage.add(h));
            // Start at stage 2 in edit mode (country can't be changed)
            this.stage = 2;
        } else if (this.preselectedCountry) {
            const country = this.allCountries.find(c => c.id === this.preselectedCountry!.id);
            if (country) this.setCountry(country);
            this.stage = 2;
        } else {
            this.stage = 1;
        }
    }

    private setCountry(country: Country) {
        this.selectedCountry = country;
        // Load subdivisions
        const grouped = new Map<string, Subdivision[]>();
        for (const sub of (country.subdivisions || [])) {
            const type = sub.division || 'other';
            if (!grouped.has(type)) grouped.set(type, []);
            grouped.get(type)!.push(sub);
        }
        this.subdivisionGroups = Array.from(grouped.entries()).map(([type, subs]) => ({
            divisionType: type,
            label: this.pluralize(type),
            subdivisions: subs.sort((a, b) => a.name.localeCompare(b.name)),
            expanded: false
        }));
        this.heritageSites = country.worldHeritageSites || [];
    }

    // ── Country search ───────────────────────────────────────
    onCountrySearch(val: string) {
        this.countrySearch = val;
        this.updateFilteredCountries();
    }

    private updateFilteredCountries() {
        const q = this.countrySearch.toLowerCase().trim();
        this.filteredCountries = q
            ? this.allCountries.filter(c => c.name.toLowerCase().includes(q)).slice(0, 12)
            : this.allCountries.slice(0, 12);
    }

    selectCountry(country: Country) {
        this.setCountry(country);
        this.stage = 2;
    }

    // ── Stage 2 ──────────────────────────────────────────────
    setStatus(s: 'visited' | 'planned') {
        this.status = s;
        // Clamp month if switching to visited and selected month is in the future
        if (s === 'visited' && this.selectedMonth > this.maxMonth) {
            this.selectedMonth = this.maxMonth;
        }
    }

    isMonthDisabled(m: number): boolean {
        if (this.status !== 'visited') return false;
        const now = new Date();
        if (this.selectedYear > now.getFullYear()) return true;
        if (this.selectedYear === now.getFullYear()) return m > now.getMonth() + 1;
        return false;
    }

    doSkipDate() {
        this.skipDate = true;
        this.goNext();
    }

    // ── Navigation ───────────────────────────────────────────
    goBack() {
        if (this.stage > 1) this.stage = (this.stage - 1) as any;
        if (this.stage === 1 && (this.preselectedCountry || this.existingEntry)) {
            this.close();
        }
    }

    goNext() {
        if (this.stage < this.TOTAL_STAGES) {
            this.stage = (this.stage + 1) as any;
        } else {
            this.submit();
        }
    }

    canGoNext(): boolean {
        if (this.stage === 1) return !!this.selectedCountry;
        if (this.stage === 2) return this.skipDate || this.selectedYear > 0;
        return true;
    }

    // ── Subdivisions & heritage ──────────────────────────────
    toggleSubdivision(code: string) {
        if (this.selectedSubdivisions.has(code)) {
            this.selectedSubdivisions.delete(code);
        } else {
            this.selectedSubdivisions.add(code);
        }
    }

    toggleHeritage(idNo: string) {
        if (this.selectedHeritage.has(idNo)) {
            this.selectedHeritage.delete(idNo);
        } else {
            this.selectedHeritage.add(idNo);
        }
    }

    toggleGroup(group: SubdivisionGroup) {
        group.expanded = !group.expanded;
    }

    countSelectedInGroup(group: SubdivisionGroup): number {
        return group.subdivisions.filter(s => this.selectedSubdivisions.has(s.code)).length;
    }

    // ── Rating ───────────────────────────────────────────────
    setRating(r: number) { this.rating = r; }
    setHoverRating(r: number) { this.hoverRating = r; }
    clearHoverRating() { this.hoverRating = 0; }
    getStarState(i: number): 'filled' | 'empty' {
        return (this.hoverRating || this.rating) >= i ? 'filled' : 'empty';
    }

    // ── Save ─────────────────────────────────────────────────
    async submit() {
        if (!this.selectedCountry) return;
        this.saving = true;
        this.error = null;
        try {
            const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
            if (!user) { this.auth.loginWithGoogle(); return; }

            const date = this.skipDate ? '' : this.selectedMonth > 0
                ? `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}`
                : `${this.selectedYear}`;
            const payload: Omit<TravelEntry, 'id' | 'createdAt'> = {
                countryId: this.selectedCountry.id,
                countryName: this.selectedCountry.name,
                status: this.status,
                date,
                needsDate: this.skipDate || undefined,
                subdivisions: [...this.selectedSubdivisions],
                heritageSites: [...this.selectedHeritage],
                note: this.note.trim() || undefined,
                rating: this.rating || undefined
            };

            if (this.existingEntry?.id && !this.existingEntry.id.startsWith('legacy-')) {
                await this.travel.updateTravelEntry(user.uid, this.existingEntry.id, {
                    status: payload.status,
                    date: payload.date,
                    needsDate: payload.needsDate,
                    subdivisions: payload.subdivisions,
                    heritageSites: payload.heritageSites,
                    note: payload.note,
                    rating: payload.rating
                });
            } else {
                await this.travel.addTravelEntry(payload);
            }

            this.saved.emit();
            this.close();
        } catch (e) {
            this.error = 'Failed to save. Please try again.';
        } finally {
            this.saving = false;
        }
    }

    // ── Delete ───────────────────────────────────────────────
    async deleteEntry() {
        if (!this.existingEntry || this.existingEntry.id.startsWith('legacy-')) return;
        this.deleting = true;
        this.error = null;
        try {
            const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
            if (!user) return;
            await this.travel.deleteTravelEntry(user.uid, this.existingEntry.id);
            this.saved.emit();
            this.closed.emit();
        } catch (e) {
            this.error = 'Failed to remove entry. Please try again.';
        } finally {
            this.deleting = false;
        }
    }

    // ── Close ────────────────────────────────────────────────
    @HostListener('keydown.escape')
    close() { this.closed.emit(); }

    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('entry-backdrop')) {
            this.close();
        }
    }

    // ── Helpers ──────────────────────────────────────────────
    private pluralize(type: string): string {
        const cap = type.charAt(0).toUpperCase() + type.slice(1);
        if (type.endsWith('y') && !['ey','ay','oy'].some(s => type.endsWith(s))) return cap.slice(0,-1) + 'ies';
        if (['sh','ch','ss','x'].some(s => type.endsWith(s))) return cap + 'es';
        return cap + 's';
    }
}
