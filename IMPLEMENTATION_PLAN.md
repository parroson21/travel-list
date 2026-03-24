# SPA Refactor — Implementation Plan

Tracks the transition from multi-page routing to a single-page hash-based architecture with a global search overlay, read-only country overlay, and a multi-step AddEntry wizard.

---

## Status Key
- `[x]` Done
- `[~]` Done but needs follow-up
- `[ ]` Not started

---

## 1. Data Model
**File:** `src/app/models/travel.model.ts`

- [x] Extend `TravelEntry` with `date` (YYYY-MM string), `subdivisions: string[]`, `heritageSites: string[]`, `rating?: number`, `note?: string`, `needsDate?: true`

---

## 2. Routing
**File:** `src/app/app.routes.ts`

- [x] Remove `/explore` and `/explore/:countryId` routes
- [x] Country detail is now an overlay driven by URL hash (`#country/CA`), not a route

---

## 3. HashRouterService
**File:** `src/app/services/hash-router.service.ts`

- [x] `openCountry(id)` — sets hash, emits synchronously via `zone.run()`, locks body scroll
- [x] `closeCountry()` — clears hash, emits null, restores body scroll
- [x] `activeCountryId$: Observable<string | null>` — parses hash on `hashchange`

---

## 4. Global Search Overlay

### SearchOverlayService
**File:** `src/app/services/search-overlay.service.ts`
- [x] `open()` / `close()` / `isOpen$`

### SearchOverlayComponent
**File:** `src/app/components/search-overlay/`
- [x] Categorised results: Countries → Heritage Sites → Users
- [x] Clicking a country calls `hashRouter.openCountry(id)`
- [x] Fixed text colours (were using nonexistent `--text-primary/secondary/tertiary` CSS vars with white fallbacks — now uses `--text-main` / `--text-muted`)
- [x] Fixed one-character-behind CD lag (added `cdr.markForCheck()` after sync results and after async Firestore results)

### Navbar
- [x] Remove Explore link; add search icon that calls `SearchOverlayService.open()`
- [x] Mount `<app-search-overlay>` in navbar template

---

## 5. TravelService
**File:** `src/app/services/travel.service.ts`

- [x] `addTravelEntry` / `updateTravelEntry` / `deleteTravelEntry` — dual-write to flat caches
- [x] `migrateLegacyEntries(uid)` — backfills old entries to new schema

---

## 6. AddEntry Wizard
**Files:** `src/app/components/add-entry/`

4-stage modal wizard: Country picker → Date → Subdivisions + Heritage → Rating + Note

- [x] `preselectedCountry` input skips Stage 1
- [x] `existingEntry` input enters edit mode
- [x] `(saved)` / `(closed)` outputs
- [x] **Delete flow in edit mode** — trash button in Stage 4 footer calls `TravelService.deleteTravelEntry`

---

## 7. Country Detail → Read-Only Overlay
**Files:** `src/app/components/country-detail/`

- [x] Driven by `HashRouterService.activeCountryId$`
- [x] Visited state derived exclusively from `TravelEntry` records
- [x] Overlay CSS redesigned as a centred modal (flex backdrop, `border-radius`, `max-width`, slide-in animation)
- [x] Body scroll locked while overlay is open (via `HashRouterService`)
- [x] "Log a visit" button opens `AddEntryComponent`

### Known issues
- [ ] Anonymous users — guard entry subscription so it returns `[]` when not logged in

---

## 8. WorldMapComponent
**File:** `src/app/components/world-map/world-map.component.ts`

- [x] `countryClicked` Output emits GeoJSON country name when a visited/planned polygon is clicked
- [x] **Unique map container ID per instance** (`mapContainerId = 'map-container-<random>'`) — fixes dual-map conflict when the profile map and the overlay map are on screen simultaneously

---

## 9. Profile Page
**Files:** `src/app/components/profile/`

- [x] Replaced `EntryModalComponent` with `AddEntryComponent`
- [x] `navigateToCountry(id)` calls `hashRouter.openCountry(id)`
- [x] `(countryClicked)` output wired on `app-world-map`

---

## 10. UserProfileComponent (root route `/` and `/user/:username`)
**Files:** `src/app/components/user-profile/`

- [x] Injected `HashRouterService`
- [x] `navigateToCountry` fixed from dead `router.navigate(['/explore', id])` → `hashRouter.openCountry(id)`
- [x] `onMapCountryClicked` added; `(countryClicked)` wired on `app-world-map`
- [ ] **Swap `EntryModalComponent` → `AddEntryComponent`** — `openEditModal` still opens the old modal
  - Remove `EntryModalComponent` import; add `AddEntryComponent`
  - Replace `<app-entry-modal>` in template with `<app-add-entry [preselectedCountry]="..." [existingEntry]="..." (saved)="closeEditModal()" (closed)="closeEditModal()">`
- [ ] Remove `togglePOIVisited` / `isPOIVisited` / `markPOIVisited` methods — conflicts with new model; heritage visited state is read-only
- [ ] Replace `btn-visited` "Mark Visited" toggle button in heritage inline detail with a read-only **Visited ✓** badge

---

## 11. Admin — Migration Trigger
**Files:** `src/app/components/admin/`

- [x] UID input + "Migrate Legacy Entries" button + log output added

---

## 12. ExploreComponent Cleanup
**File:** `src/app/components/explore/`

- [ ] Delete entire directory (no longer routed or imported)

---

## Build Status

Dev server running on **port 5478** (`npm run start`). Last build: clean.

### Quick sanity checks if build breaks
```bash
# Any remaining old modal references?
grep -r "app-entry-modal" src/

# Any remaining /explore navigations?
grep -r "explore" src/app/components --include="*.ts"
```
