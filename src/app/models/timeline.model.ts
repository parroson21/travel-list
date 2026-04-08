/**
 * Generic timeline data contract.
 *
 * Every consumer (user-profile, global feed, following feed) maps its raw
 * domain data into TimelineItem[] before passing it to <app-timeline>.
 * The component itself is completely decoupled from Firestore / domain types.
 */

export type TimelineEventType =
  | 'visited'   // Marked a country as visited
  | 'planned'   // Added a future trip plan
  | 'heritage'  // Visited a UNESCO heritage site
  | 'joined';   // User joined the app (anchor event at the bottom of profile timelines)

export interface TimelineItem {
  /** Unique key for Angular trackBy — must be stable across re-renders. */
  id: string;

  type: TimelineEventType;

  // ── Actor fields (populated by following / global feeds, absent on self-view) ──
  actorUid?: string;
  actorUsername?: string;
  actorDisplayName?: string;
  actorPhotoURL?: string;

  // ── Payload ──
  countryId?: string;
  countryName?: string;
  countryEmoji?: string;
  siteName?: string;   // kept for backwards compat — unused by mapper now
  heritageSites?: string[]; // Names of visited heritage sites, listed under the entry

  note?: string;
  rating?: number;     // 1–5 stars

  /**
   * The trip date string (YYYY-MM) when available — shown as supplementary
   * info beneath the country name (e.g. "March 2023").
   * Undefined for legacy entries without a date, heritage sub-events, and joined events.
   */
  tripDate?: string;

  /**
   * ISO timestamp of when this entry was *created/logged* in the app (createdAt).
   * Used for chronological sorting and the relative-time label ("3 weeks ago").
   * Falls back to epoch when createdAt is absent (legacy phantom entries).
   */
  timestamp: string;
}
