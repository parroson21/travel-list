import { TravelEntry, UserProfile, Country } from '../../models/travel.model';
import { TimelineItem, TimelineEventType } from '../../models/timeline.model';

/**
 * Pure mapper — no Angular or Firestore dependency.
 *
 * Converts a user's TravelEntry[] into a sorted TimelineItem[] for <app-timeline>.
 *
 * Timestamp strategy (activity-feed model):
 *   - `timestamp` = entry.createdAt — "when was this logged?" drives the relative label
 *   - `tripDate`  = entry.date (YYYY-MM) — shown as supplementary trip info
 *
 * This means "10 minutes ago — Planned to visit Portugal" reflects when the
 * plan was *added*, not when the trip is scheduled. Heritage sub-events share
 * the parent entry's createdAt.
 *
 * @param entries       Raw TravelEntry documents for one user
 * @param countryMap    Map<countryId, Country> for emoji / name lookup
 * @param profile       Optional — appends a 'joined' anchor event at the bottom
 * @param actorOverride Optional — attach actor fields for following/global feeds
 */
export function mapEntriesToTimeline(
    entries: TravelEntry[],
    countryMap: Map<string, Country>,
    profile?: UserProfile | null,
    actorOverride?: {
        uid: string;
        username?: string;
        displayName?: string;
        photoURL?: string;
    }
): TimelineItem[] {
    const items: TimelineItem[] = [];
    const actor = buildActor(actorOverride);

    for (const entry of entries) {
        const country = countryMap.get(entry.countryId);

        // Activity timestamp: last edit wins; fall back to createdAt for new entries.
        // Phantom/legacy entries have empty createdAt — push them to the end.
        const timestamp = entry.updatedAt || entry.createdAt || new Date(0).toISOString();
        const isLegacy = !entry.createdAt;

        // Trip date for display (YYYY-MM → "March 2023")
        const tripDate = entry.date || undefined;

        const primaryType: TimelineEventType =
            entry.status === 'planned' ? 'planned' : 'visited';

        // Resolve heritage site names for this entry
        const heritageSiteIds = entry.heritageSites || [];
        const heritageSiteNames: string[] = heritageSiteIds
            .map((siteId: any) => {
                const site = (country?.worldHeritageSites || []).find(
                    (s: any) => String(s.id_no) === String(siteId)
                );
                return site?.name_en || null;
            })
            .filter(Boolean) as string[];

        // Resolve subdivision codes to display names for this entry
        const subdivisionCodes = entry.subdivisions || [];
        const subdivisionNames: string[] = subdivisionCodes
            .map((code: string) => {
                const sub = (country?.subdivisions || []).find(
                    (s: any) => s.code === code
                );
                return sub?.name || null;
            })
            .filter(Boolean) as string[];

        // ── Primary event ────────────────────────────────────────────────────
        items.push({
            id: entry.id || `entry-${entry.countryId}-${timestamp}`,
            type: primaryType,
            ...actor,
            countryId: entry.countryId,
            countryName: country?.name || entry.countryName,
            countryEmoji: country?.emoji,
            note: entry.note,
            rating: entry.rating,
            heritageSites: heritageSiteNames.length > 0 ? heritageSiteNames : undefined,
            subdivisions: subdivisionNames.length > 0 ? subdivisionNames : undefined,
            tripDate: isLegacy ? undefined : tripDate,
            timestamp,
        });
    }

    // ── Optional 'joined' anchor event ───────────────────────────────────────
    if (profile?.createdAt) {
        items.push({
            id: `joined-${profile.uid}`,
            type: 'joined',
            ...actor,
            timestamp: profile.createdAt,
        });
    }

    // Sort: newest createdAt first; legacy (empty createdAt) cluster at the bottom
    items.sort((a, b) => {
        const aIsEpoch = a.timestamp === new Date(0).toISOString();
        const bIsEpoch = b.timestamp === new Date(0).toISOString();
        if (aIsEpoch !== bIsEpoch) return aIsEpoch ? 1 : -1;
        return b.timestamp.localeCompare(a.timestamp);
    });

    return items;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildActor(override?: {
    uid: string;
    username?: string;
    displayName?: string;
    photoURL?: string;
}): Partial<Pick<TimelineItem, 'actorUid' | 'actorUsername' | 'actorDisplayName' | 'actorPhotoURL'>> {
    if (!override) return {};
    return {
        actorUid: override.uid,
        actorUsername: override.username,
        actorDisplayName: override.displayName,
        actorPhotoURL: override.photoURL,
    };
}
