import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Country, UserProfile } from '../../../models/travel.model';

@Component({
    selector: 'app-profile-stats',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, DecimalPipe],
    templateUrl: './profile-stats.component.html',
    styleUrls: ['./profile-stats.component.css']
})
export class ProfileStatsComponent {
    @Input() user!: { photoURL?: string | null; displayName?: string | null; email?: string | null };
    @Input() profile: UserProfile | null = null;
    @Input() homeCountry: Country | undefined;
    @Input() visitedCountries: Country[] = [];
    @Input() stats: { countriesVisited: number; poisVisited: number; countriesPlanned: number } = {
        countriesVisited: 0, poisVisited: 0, countriesPlanned: 0
    };

    @Output() homePickerOpen = new EventEmitter<Event>();

    isOnline(isoTimestamp: string | undefined): boolean {
        if (!isoTimestamp) return false;
        return Date.now() - new Date(isoTimestamp).getTime() < 5 * 60 * 1000;
    }
}
