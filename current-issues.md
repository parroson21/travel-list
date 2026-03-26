## Issue 4 — GeoJSON Storage Migration

Move country geometry out of the static `public/countries.geojson` (~13 MB) and into Firestore so it can be fetched on demand.

**Steps:**
1. Write a one-time Node.js upload script (`scripts/upload-geojson.js`) that reads `public/countries.geojson`, splits each country feature into its own Firestore document in a `geojson` collection (keyed by ISO country code), and uploads in batches.
2. Add a `getCountryGeometry(isoCode)` method to the relevant map/travel service that fetches the feature from Firestore by document ID.
3. Update the world map component to call this service method instead of doing a static `fetch('/countries.geojson')`. Cache fetched features in-memory during the session to avoid redundant reads.
4. Once migration is validated, delete `public/countries.geojson` and `public/geojson/` from the repo and add them to `.gitignore` as a safeguard.

**Notes:**
- This is the most complex remaining item — do steps in order and validate the map renders correctly before deleting the static files.
- Firestore read costs will increase; in-memory caching per session is essential.
- The existing `public/countries.json` (country metadata, ~2.8 MB) is separate and may not need to move.

---

## Issue 5 — Firebase API Key Exposure

The Firebase config (including the API key) is hardcoded in `src/app/app.config.ts` and has been committed to the git repo.

**Steps:**
1. Create `src/environments/environment.ts` and `environment.prod.ts` with the `firebaseConfig` object inside an `environment` export.
2. Update `app.config.ts` to import from `environment.ts` instead of declaring the config inline.
3. Add `src/environments/environment*.ts` to `.gitignore`. Commit a safe `environment.example.ts` placeholder so others know the shape.
4. Use `git filter-repo` to scrub the API key from all prior commits, then force-push. (**Destructive — coordinate with any collaborators first.**)
5. After scrubbing history, rotate the Firebase API key in the Firebase console and update the local environment file.

**Notes:**
- Simply adding the file to `.gitignore` is NOT enough — the key is already in history and must be scrubbed.
- `git filter-repo` is the recommended tool (safer than `git filter-branch`). Install via `pip install git-filter-repo`.
- The Angular build system already supports environment files — `ng build --configuration production` will swap in `environment.prod.ts` automatically if `angular.json` is configured for file replacements.
