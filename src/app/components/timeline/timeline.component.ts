import { Component, Input, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineItem } from '../../models/timeline.model';

@Component({
    selector: 'app-timeline',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule],
    templateUrl: './timeline.component.html',
    styleUrls: ['./timeline.component.css']
})
export class TimelineComponent implements OnChanges {

    /**
     * Sorted list of timeline items (newest-first).
     * Each item carries its own relative timestamp label.
     */
    @Input() items: TimelineItem[] = [];

    /** When true, renders a skeleton loader instead of items. */
    @Input() loading = false;

    /**
     * When true, renders the actor avatar + username chip per item.
     * Set to true for global / following feeds; false (default) for profile view.
     */
    @Input() showActor = false;

    /** Override the "no activity yet" copy. */
    @Input() emptyMessage = 'No travel activity yet.';

    /** Items with precomputed relative timestamp strings. */
    processedItems: (TimelineItem & { relTime: string; formattedTripDate: string | null })[] = [];

    ngOnChanges(): void {
        this.processedItems = this.items.map(item => ({
            ...item,
            relTime: this.relativeTime(item.timestamp),
            formattedTripDate: this.formatTripDate(item.tripDate)
        }));
    }

    trackById(_: number, item: TimelineItem): string {
        return item.id;
    }

    typeIcon(_item: TimelineItem): string {
        // No emoji — dot colour is driven by .tl-item--* CSS class
        return '';
    }

    typeLabel(item: TimelineItem): string {
        switch (item.type) {
            case 'visited':  return 'Visited';
            case 'planned':  return 'Planned to visit';
            case 'heritage': return 'Visited heritage site';
            case 'joined':   return 'Joined TravelList';
        }
    }

    stars(rating: number | undefined): readonly number[] {
        if (!rating) return [];
        return Array.from({ length: rating }, (_, i) => i);
    }

    /**
     * Converts a YYYY-MM trip date string to a readable label like "March 2023".
     * Returns null when tripDate is absent (legacy entries, heritage events, joined).
     */
    formatTripDate(tripDate: string | undefined): string | null {
        if (!tripDate || tripDate.length < 7) return null;
        const d = new Date(`${tripDate.substring(0, 7)}-15`); // mid-month avoids TZ edge cases
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /**
     * Converts an ISO timestamp to a human-readable relative string.
     * e.g. "10 minutes ago", "3 weeks ago", "1 year ago".
     *
     * Trip-date entries are stored as YYYY-MM-01T00:00:00.000Z (month granularity),
     * so labels like "3 months ago" / "2 years ago" are accurate enough.
     */
    relativeTime(iso: string): string {
        if (!iso) return '';
        const now = new Date();
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';

        const diffMs     = now.getTime() - date.getTime();
        const diffMins   = Math.floor(diffMs / 60_000);
        const diffHours  = Math.floor(diffMs / 3_600_000);
        const diffDays   = Math.floor(diffMs / 86_400_000);
        const diffWeeks  = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30.44);
        const diffYears  = Math.floor(diffDays / 365.25);

        if (diffMins  < 1)    return 'Just now';
        if (diffMins  < 60)   return `${diffMins} minute${diffMins  === 1 ? '' : 's'} ago`;
        if (diffHours < 24)   return `${diffHours} hour${diffHours  === 1 ? '' : 's'} ago`;
        if (diffDays  === 1)  return 'Yesterday';
        if (diffDays  < 14)   return `${diffDays} days ago`;
        if (diffWeeks < 8)    return `${diffWeeks} week${diffWeeks  === 1 ? '' : 's'} ago`;
        if (diffMonths < 12)  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
        if (diffYears === 1)  return '1 year ago';
        return `${diffYears} years ago`;
    }
}
