import { Component, Input, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { TimelineItem } from '../../models/timeline.model';

@Component({
    selector: 'app-timeline',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, UpperCasePipe],
    templateUrl: './timeline.component.html',
    styleUrls: ['./timeline.component.css']
})
export class TimelineComponent implements OnChanges {

    @Input() items: TimelineItem[] = [];
    @Input() loading = false;
    @Input() showActor = false;
    @Input() emptyMessage = 'No travel activity yet.';

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

    /** Section label shown above each card (matches the image: UPCOMING / COMPLETED / MILESTONE) */
    sectionLabel(item: TimelineItem): string {
        switch (item.type) {
            case 'planned':  return 'Planned';
            case 'visited':  return 'Visited';
            case 'heritage': return 'Heritage Site';
            case 'joined':   return 'Milestone';
        }
    }

    /** Bold title for joined/milestone cards */
    milestoneTitle(item: TimelineItem): string {
        if (item.type === 'joined') return 'Joined TravelList';
        return item.countryName || 'Milestone';
    }

    /** Subtitle for joined/milestone cards */
    milestoneDesc(item: TimelineItem): string {
        if (item.type === 'joined') return 'Started logging expeditions.';
        return item.note || '';
    }

    stars(rating: number | undefined): readonly number[] {
        if (!rating) return [];
        return Array.from({ length: rating }, (_, i) => i);
    }

    emptyStars(rating: number | undefined): readonly number[] {
        if (!rating) return [];
        const filled = Math.min(rating, 5);
        return Array.from({ length: 5 - filled }, (_, i) => i);
    }

    formatTripDate(tripDate: string | undefined): string | null {
        if (!tripDate || tripDate.length < 7) return null;
        const d = new Date(`${tripDate.substring(0, 7)}-15`);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

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
