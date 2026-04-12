import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, of, combineLatest } from 'rxjs';
import { switchMap, map, startWith } from 'rxjs/operators';

import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { TimelineComponent } from '../timeline/timeline.component';
import { TimelineItem } from '../../models/timeline.model';
import { mapEntriesToTimeline } from '../timeline/timeline-mapper';
import { UserProfile, Country } from '../../models/travel.model';

@Component({
    selector: 'app-feed',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TimelineComponent],
    templateUrl: './feed.component.html',
    styleUrls: ['./feed.component.css']
})
export class FeedComponent implements OnInit {

    vm$: Observable<{
        currentUser: import('@angular/fire/auth').User | null;
        profile: UserProfile | null;
        items: TimelineItem[];
        loading: boolean;
    }> | undefined;

    constructor(
        private travel: TravelService,
        public auth: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        const countries$ = this.travel.getCountries();

        this.vm$ = combineLatest([
            this.auth.user$.pipe(startWith(null)),
            countries$
        ]).pipe(
            switchMap(([currentUser, countries]) => {
                if (!currentUser) {
                    return of({ currentUser, profile: null, items: [] as TimelineItem[], loading: false });
                }

                const countryMap = new Map(countries.map((c: Country) => [c.id, c]));

                return this.travel.getUserProfile().pipe(
                    switchMap((profile) => {
                        if (!profile) {
                            return of({ currentUser, profile: null, items: [] as TimelineItem[], loading: false });
                        }

                        // Collect own UID + all followed UIDs
                        const feedUids = [profile.uid, ...(profile.following || [])];

                        return this.travel.getFeedEntries(feedUids).pipe(
                            map(pairs => {
                                // Group by UID to build actor-tagged timeline items
                                const byUid = new Map<string, { entries: typeof pairs; profile: UserProfile }>();
                                for (const pair of pairs) {
                                    if (!pair.profile) continue;
                                    const uid = pair.profile.uid;
                                    if (!uid) continue;
                                    if (!byUid.has(uid)) byUid.set(uid, { entries: [], profile: pair.profile });
                                    byUid.get(uid)!.entries.push(pair);
                                }

                                const items: TimelineItem[] = [];
                                for (const [, { entries, profile: actorProfile }] of byUid) {
                                    const actor = {
                                        uid: actorProfile.uid,
                                        username: actorProfile.username,
                                        displayName: actorProfile.displayName,
                                        photoURL: actorProfile.photoURL
                                    };
                                    const mapped = mapEntriesToTimeline(
                                        entries.map(p => p.entry),
                                        countryMap,
                                        null,
                                        actor
                                    );
                                    items.push(...mapped);
                                }

                                // Sort all items newest-first
                                items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                                return { currentUser, profile, items, loading: false };
                            })
                        );
                    })
                );
            })
        );
    }

    login() { this.auth.loginWithGoogle(); }

    goToSearch() {
        // Trigger global search overlay via service if available; fallback to navigate
        this.router.navigate(['/']);
    }
}
