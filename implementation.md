# Social Feed & Following Feature

Add a follower/following system and replace the `/` root route with a social feed that shows activity from the current user and everyone they follow.

## Proposed Changes

---

### Data Layer

#### [MODIFY] [travel.model.ts](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/models/travel.model.ts)
- Add `following?: string[]` (UIDs this user follows) and `followers?: string[]` (UIDs following this user) to `UserProfile`.

#### [MODIFY] [travel.service.ts](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/services/travel.service.ts)
- `followUser(targetUid)` — atomically adds current user's UID to target's `followers[]` and adds `targetUid` to current user's `following[]`. Uses a `writeBatch`.
- `unfollowUser(targetUid)` — same in reverse with `arrayRemove`.
- `isFollowing(targetUid)` — simple helper reading from the local profile stream (no extra Firestore call).
- `getFeedEntries(followingUids: string[])` — fetches `travelEntries` for a list of UIDs and streams them together via `combineLatest`. Returns `{ entry, profile }[]` for actor rendering.

---

### Social Feed (new `/` route)

#### [NEW] `src/app/components/feed/feed.component.ts`
New standalone component for the `/` route. Replaces `UserProfileComponent` there.
- Subscribes to the current user's profile to get `following[]`.
- Streams the own entries + following entries in parallel.
- Maps everything to `TimelineItem[]` using the existing `mapEntriesToTimeline` with `actorOverride` populated.
- Passes items to `<app-timeline [showActor]="true">`.
- When not logged in: shows the existing welcome/hero unauthenticated state (lifted from `user-profile`).
- When logged in but following nobody: shows a friendly empty state with a suggestion to search for users.

#### [NEW] `src/app/components/feed/feed.component.html`
- Header: "Your Feed" title + entry count.
- `<app-timeline>` with `showActor="true"`.
- Unauthenticated / empty states.

#### [NEW] `src/app/components/feed/feed.component.css`
- Simple page layout wrapping the timeline, consistent max-width + padding.

---

### Follow Button on User Profiles

#### [MODIFY] [user-profile.component.html](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/components/user-profile/user-profile.component.html)
- Add **Follow / Unfollow** button in the profile header next to the "You" badge — visible only when `!vm.isOwnProfile && currentUser`.
- Button uses `vm.isFollowing` derived from the vm and calls `toggleFollow()`.

#### [MODIFY] [user-profile.component.ts](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/components/user-profile/user-profile.component.ts)
- Add `isFollowing` to the vm$ pipe (derived from `currentUserProfile.following.includes(targetProfile.uid)`).
- Add `toggleFollow(targetUid)` method calling `travel.followUser` / `travel.unfollowUser`.
- Stream the current user's own profile in the vm$ observable (already available via `currentUser` but needs full `UserProfile` for `following[]`).

#### [MODIFY] [user-profile.component.css](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/components/user-profile/user-profile.component.css)
- Style the follow button (pill shape, primary color fill when following, outlined when not).

---

### Routing

#### [MODIFY] [app.routes.ts](file:///c:/Users/Thomas/Desktop/Projects/travel-list/src/app/app.routes.ts)
- `{ path: '', component: FeedComponent }` — new home.
- `{ path: 'me', component: UserProfileComponent }` — own profile via `/me`.
- Keep `{ path: 'user/:username', component: UserProfileComponent }`.

#### [MODIFY] Navbar
- Update the "home" / avatar nav link to point to `/me` for own profile instead of `/`.

---

## Open Questions

> [!IMPORTANT]
> **Own profile nav**: Currently `/` shows the user's own profile. After this change it moves to `/me`. Should the navbar's avatar/profile icon link to `/me`, or do you prefer a different URL like `/profile`?

> [!NOTE]
> **Feed for logged-out users**: The current `/` welcome hero will move to the feed page. This is straightforward — treating it the same as the existing unauthenticated state.

> [!NOTE]
> **Firestore reads**: Fetching entries for many followed users means one `getTravelEntries` call per followed UID. This is fine at small scale (real-time listeners). For large follower counts a denormalised feed collection would be needed, but that's a future concern.

## Verification Plan

### Manual Verification
1. Visit `/user/:username` for another user → Follow button appears; clicking it updates both profiles in Firestore.
2. Visit `/` while logged in → Own entries + followed users' entries appear in the timeline with actor chips.
3. Visit `/me` → Own profile (map + tabs + timeline) loads as before.
4. Logged-out at `/` → Welcome hero displays.
