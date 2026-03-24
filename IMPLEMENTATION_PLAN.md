# SPA Refactor — Implementation Plan

Tracks the transition from multi-page routing to a single-page hash-based architecture with a global search overlay, read-only country overlay, and a multi-step AddEntry wizard.

---

## Status Key
- `[x]` Done
- `[~]` Done but needs verification / minor follow-up
- `[ ]` Not started

---

## 1. Data Model  
**File:** `src/app/models/travel.model.ts`

- [x] Extend `TravelEntry` with:
  - `date` changed to `YYYY-MM` string (empty = legacy/skipped)
  - `subdivisions: string[]` — codes visited on this trip
  - `heritageSites: string[]` — `id_no` values visited on this trip
  - `rating?: number` (1–5)
  - `note?: string`
  - `needsDate?: true` — user explicitly skipped the date

---

## 2. Routing

**File:** `src/app/app.routes.ts`

- [x] Remove `/explore` and `/explore/:countryId` routes
- [x] Add redirect `'' → '/'` for unknown paths
- [x] Country detail is now an overlay driven by URL hash (`#country/CA`), not a route

---

## 3. HashRouterService
**File:** `src/app/services/hash-router.service.ts`  *(new)*

- [x] `openCountry(id)` — sets `window.location.hash = 'country/' + id`
- [x] `closeCountry()` — clears the hash
- [x] `activeCountryId$: Observable<string | null>` — parses hash on `hashchange`

---

## 4. Global Search Overlay

### SearchOverlayService
**File:** `src/app/services/search-overlay.service.ts`  *(new)*
- [x] `open()` / `close()` / `isOpen$`

### SearchOverlayComponent
**File:** `src/app/components/search-overlay/`  *(new)*
- [x] Full-width backdrop input that activates on search icon click in navbar
- [x] Categorised results: **Countries** → **Heritage Sites** → **Users**
- [x] Clicking a country result calls `HashRouterService.openCountry(id)`
- [x] User results show username, home country flag (if set), and last-online

### Navbar
**Files:** `navbar.component.ts` / `navbar.html` / `navbar.scss`
- [x] Remove "Explore" link from desktop nav and mobile FAB
- [x] Add magnifying-glass icon button that calls `SearchOverlayService.open()`
- [x] Mount `<app-search-overlay>` at bottom of navbar template

---

## 5. TravelService

**File:** `src/app/services/travel.service.ts`

- [x] `addTravelEntry` — writes `subdivisions` / `heritageSites` / `rating` / `note` to Firestore; dual-writes to flat `UserProfile.visitedSubdivisions` / `visitedPOIs` caches
- [x] `updateTravelEntry` — same dual-write; recomputes caches from all entries
- [x] `deleteTravelEntry` — recomputes caches after deletion
- [x] `migrateLegacyEntries(uid)` — backfills old entries to new schema (sets `needsDate: true` if no date)
- [x] Removed `exploreState` property (no longer needed)
- [x] Deprecated `toggleSubdivisionVisited` / `markPOIVisited` (caches now managed by AddEntry only)

> **Note:** The old `ExploreComponent` still exists as a file (it redirects). Its `exploreState` references were removed so it compiles cleanly. It can be deleted entirely once the team is satisfied with the search overlay.

---

## 6. AddEntry Wizard

**Files:** `src/app/components/add-entry/`  *(new)*

A 4-stage modal wizard:

| Stage | Content |
|-------|---------|
| 1 | Country search list (skipped if `preselectedCountry` input is set) |
| 2 | Visited / Planned toggle + month grid + year arrows + "Skip date" |
| 3 | Subdivision accordion + Heritage site checkboxes |
| 4 | Star rating (optional) + note textarea (optional) |

**Inputs:**
- `preselectedCountry?: { id, name, emoji }` — skips Stage 1
- `existingEntry?: TravelEntry` — enters edit mode, starts at Stage 2

**Outputs:**
- `(saved)` — entry was written to Firestore
- `(closed)` — user dismissed without saving

### Files created
- [x] `add-entry.component.ts` — full wizard logic
- [x] `add-entry.component.html` — 4-stage template
- [x] `add-entry.component.css` — styles (backdrop, step dots, month grid, stars, etc.)

### Known issues / TODOs
- [ ] **Delete (remove) flow in edit mode** — the old `EntryModal` had an `[allowRemove]` input and `(removed)` output. The new `AddEntryComponent` does not yet have a delete button. Add a "Remove entry" button to Stage 4 (or a footer trash icon) that calls `TravelService.deleteTravelEntry` and emits `(saved)`.
- [ ] Subdivisions in Stage 3 currently load from `country.subdivisions` (embedded in the country document). Verify this is populated for all countries; if not, fall back to `TravelService.getSubdivisions(countryId)`.

---

## 7. Country Detail → Read-Only Overlay

**Files:** `src/app/components/country-detail/`

- [x] Renamed exported class to `CountryOverlayComponent`; selector changed to `app-country-overlay`
- [x] Driven by `HashRouterService.activeCountryId$` — renders only when a hash is set
- [x] Wrapped in a `div.overlay-backdrop` (backdrop click closes)
- [x] Visited state derived **exclusively from `TravelEntry` records** — no direct toggles
  - `visitedSubdivisions` = union of `entry.subdivisions` across all entries for this country
  - `visitedHeritageSiteIds` = union of `entry.heritageSites` across all entries
- [x] Subdivision cards show a read-only dot indicator (not a toggle button)
- [x] Heritage site inline detail shows a "Visited" badge (not a toggle button)
- [x] "Log a visit" pill button opens `AddEntryComponent` with `preselectedCountry`
- [x] `app-entry-modal` removed; replaced with `app-add-entry`

### Known issues / TODOs
- [ ] **CountryOverlay uses `getTravelEntries(uid)` in `vm$`** — this requires the user to be logged in. For anonymous users the overlay should still show the map + subdivisions/heritage list, just without visited-state highlights. Guard the entry subscription so it returns `[]` when `profile?.uid` is falsy.
- [ ] The overlay currently uses `country.worldHeritageSites` (embedded array). Verify this is the correct field name in Firestore; if the field is `heritageSites` adjust the template binding `vm.heritageSites`.
- [ ] Confirm `WorldMapComponent` accepts `visitedCountryNames` to highlight the country even when no subdivisions are visited (currently passes the country name only if `visitedSubdivisions.length > 0 || visitedHeritageSiteIds.length > 0`).

---

## 8. App Root

**File:** `src/app/app.component.ts`

- [x] Import and mount `<app-country-overlay>` globally so the overlay is always available regardless of which route is active

---

## 9. Profile Page

**Files:** `src/app/components/profile/`

- [x] Replaced `EntryModalComponent` import with `AddEntryComponent`
- [x] Injected `HashRouterService` into constructor
- [x] `navigateToCountry(id)` now calls `hashRouter.openCountry(id)` instead of `router.navigate(['/explore', id])`
- [x] `profile.html` edit modal: `<app-entry-modal>` replaced with `<app-add-entry [preselectedCountry]="..." [existingEntry]="...">`

### Known issues / TODOs
- [ ] **Profile "Add a country" button** — there is no top-level "Log a Trip" button on the profile page yet. Add a `+` / "Log Trip" button near the tab bar header that opens `AddEntryComponent` without a `preselectedCountry` (so the user goes through Stage 1 to pick a country).
- [ ] The `openEditModal` / `closeEditModal` / `editModalCountry` / `editModalEntry` state fields still reference the old entry-modal pattern — confirm they are still wired correctly with the new `app-add-entry` inputs.
- [ ] Heritage site "Mark Visited" button in profile's inline heritage detail (`btn-visited` + `togglePOIVisited`) still directly writes to the profile — this conflicts with the new model. **Remove** `togglePOIVisited` from profile and instead open `AddEntryComponent` for the country that owns the site.

---

## 10. ExploreComponent Cleanup

**File:** `src/app/components/explore/explore.component.ts`

- [x] Removed `exploreState` references (property was deleted from `TravelService`)
- [ ] Delete the entire `ExploreComponent` directory once confirmed the redirect route is working and search overlay covers the use case

---

## 11. Admin — Migration Trigger

**Files:** `src/app/components/admin/`

- [ ] Add a "Migrate Legacy Entries" button in the admin panel that calls `TravelService.migrateLegacyEntries(uid)` for the current user (or all users if admin has a uid list)
- [ ] Show success/error toast after migration

---

## 12. UserProfile Page

**Files:** `src/app/components/user-profile/`

- [ ] Replace any remaining `router.navigate(['/explore', countryId])` calls with `hashRouter.openCountry(countryId)` (grep confirmed no references currently — verify after any future edits)
- [ ] `app-entry-modal` usage — search for any remaining references and replace with `app-add-entry`

---

## Build Status (as of last session)

The Angular dev server (`npm run start`) was running. The last observed build completed successfully:

```
Application bundle generation complete. [0.430 seconds]
```

Errors shown in the terminal before that line were from **previous** compile cycles and are no longer active. If errors appear when you restart, the most likely culprits are:

1. **`app-entry-modal`** — search the codebase for any remaining `app-entry-modal` usages in HTML templates.
   ```powershell
   Select-String -Path "src/**/*.html" -Pattern "app-entry-modal" -Recurse
   ```

2. **`exploreState`** — same pattern, search for remaining usages.
   ```powershell
   Select-String -Path "src/**/*.ts" -Pattern "exploreState" -Recurse
   ```

3. **CSS unclosed braces** — the country-detail CSS had a brace issue that was fixed. If it reappears, the `.country-detail-container {` block on line ~20 needs its properties + closing `}`.

---

## New Files Created This Session

| File | Purpose |
|------|---------|
| `src/app/services/hash-router.service.ts` | Hash-based country overlay routing |
| `src/app/services/search-overlay.service.ts` | Global search open/close state |
| `src/app/components/search-overlay/` | Search overlay component (3 files) |
| `src/app/components/add-entry/add-entry.component.ts` | AddEntry wizard logic |
| `src/app/components/add-entry/add-entry.component.html` | AddEntry wizard template |
| `src/app/components/add-entry/add-entry.component.css` | AddEntry wizard styles |

## Files Significantly Modified This Session

| File | What Changed |
|------|-------------|
| `src/app/models/travel.model.ts` | Extended `TravelEntry` with new fields |
| `src/app/app.routes.ts` | Removed explore routes |
| `src/app/app.component.ts` | Mounted `CountryOverlayComponent` globally |
| `src/app/services/travel.service.ts` | Dual-write, migration, removed exploreState |
| `src/app/components/navbar/*` | Search icon, removed Explore link |
| `src/app/components/country-detail/*` | Full rewrite to read-only overlay |
| `src/app/components/profile/profile.component.ts` | Swapped modal, injected HashRouter |
| `src/app/components/profile/profile.html` | Swapped `app-entry-modal` → `app-add-entry` |
| `src/app/components/explore/explore.component.ts` | Removed exploreState references |
