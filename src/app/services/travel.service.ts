import { Injectable, NgZone } from '@angular/core';
import { POI, Country, UserProfile, Continent, Subdivision, TravelEntry } from '../models/travel.model';
import { Firestore, collection, doc, setDoc, getDocs, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, query, where, writeBatch, orderBy, limit, startAt, endAt, addDoc, deleteDoc, deleteField } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TravelService {

    constructor(private firestore: Firestore, private auth: Auth, private zone: NgZone) {
        // Heartbeat: update lastLoginAt on login and every 3 minutes while active.
        // 2s initial delay ensures profile document exists before we updateDoc.
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
        let initialTimer: ReturnType<typeof setTimeout> | null = null;
        user(this.auth).subscribe(u => {
            if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
            if (initialTimer) { clearTimeout(initialTimer); initialTimer = null; }
            if (u) {
                initialTimer = setTimeout(() => {
                    this.updateLastSeen();
                    heartbeatInterval = setInterval(() => this.updateLastSeen(), 3 * 60 * 1000);
                }, 2000);
            }
        });
    }

    // User Profile
    getUserProfile(): Observable<UserProfile | null> {
        return user(this.auth).pipe(
            switchMap(u => {
                if (!u) return of(null);
                const userDoc = doc(this.firestore, `users/${u.uid}`);
                return new Observable<UserProfile>(observer => {
                    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
                        this.zone.run(() => {
                            if (snapshot.exists()) {
                                // Keep identity fields up to date
                                const data = snapshot.data() as UserProfile;
                                const now = new Date().toISOString();
                                const identityChanged =
                                    data.displayName !== (u.displayName || '') ||
                                    data.email !== (u.email || '') ||
                                    data.photoURL !== (u.photoURL || '');
                                const missingMeta = !data.createdAt || !data.lastLoginAt || !data.authProvider;
                                if (identityChanged || missingMeta) {
                                    const patch: Record<string, any> = {
                                        displayName: u.displayName || '',
                                        email: u.email || '',
                                        photoURL: u.photoURL || '',
                                        lastLoginAt: now,
                                        authProvider: u.providerData?.[0]?.providerId || data.authProvider || ''
                                    };
                                    if (!data.createdAt) patch['createdAt'] = now;
                                    updateDoc(userDoc, patch);
                                }
                                observer.next(data);
                            } else {
                                const newProfile: UserProfile = {
                                    uid: u.uid,
                                    displayName: u.displayName || '',
                                    email: u.email || '',
                                    photoURL: u.photoURL || '',
                                    createdAt: new Date().toISOString(),
                                    lastLoginAt: new Date().toISOString(),
                                    authProvider: u.providerData?.[0]?.providerId || '',
                                    visitedCountries: [],
                                    plannedCountries: [],
                                    visitedSubdivisions: [],
                                    visitedPOIs: []
                                };
                                setDoc(userDoc, newProfile, { merge: true });
                            }
                        });
                    }, error => observer.error(error));
                    return () => unsubscribe();
                });
            })
        );
    }

    /** Get any user's profile by UID (read-only) */
    getUserProfileById(uid: string): Observable<UserProfile | null> {
        const userDoc = doc(this.firestore, `users/${uid}`);
        return new Observable(observer => {
            const unsubscribe = onSnapshot(userDoc, snap => {
                this.zone.run(() =>
                    observer.next(snap.exists() ? snap.data() as UserProfile : null)
                );
            }, err => observer.error(err));
            return () => unsubscribe();
        });
    }

    /** Search users by username or display name — only includes users who have set a username */
    async searchUsers(q: string): Promise<UserProfile[]> {
        const query = q.toLowerCase();
        const usersCol = collection(this.firestore, 'users');
        const snap = await getDocs(usersCol);
        return snap.docs
            .map(d => d.data() as UserProfile)
            .filter(p => !!p.username && (
                (p.username || '').toLowerCase().includes(query) ||
                (p.displayName || '').toLowerCase().includes(query) ||
                (p.email || '').toLowerCase().includes(query)
            ))
            .slice(0, 20);
    }

    async markCountryVisited(countryId: string, visited: boolean) {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDoc = doc(this.firestore, `users/${u.uid}`);
        if (visited) {
            await updateDoc(userDoc, { visitedCountries: arrayUnion(countryId) });
        } else {
            await updateDoc(userDoc, { visitedCountries: arrayRemove(countryId) });
        }
    }

    /** Set a country's status: 'visited' | 'planned' | 'none' */
    async setCountryStatus(countryId: string, status: 'visited' | 'planned' | 'none') {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDoc = doc(this.firestore, `users/${u.uid}`);
        if (status === 'visited') {
            await updateDoc(userDoc, {
                visitedCountries: arrayUnion(countryId),
                plannedCountries: arrayRemove(countryId)
            });
        } else if (status === 'planned') {
            await updateDoc(userDoc, {
                plannedCountries: arrayUnion(countryId),
                visitedCountries: arrayRemove(countryId)
            });
        } else {
            await updateDoc(userDoc, {
                visitedCountries: arrayRemove(countryId),
                plannedCountries: arrayRemove(countryId)
            });
        }
    }

    // ── Travel Entries ─────────────────────────────────────

    /** Add a new travel entry, syncing visitedCountries/plannedCountries and
     *  the flat visitedSubdivisions/visitedPOIs caches. */
    async addTravelEntry(entry: Omit<TravelEntry, 'id' | 'createdAt'>): Promise<void> {
        const u = this.auth.currentUser;
        if (!u) return;
        const entriesCol = collection(this.firestore, `users/${u.uid}/travelEntries`);
        const now = new Date().toISOString();
        const docRef = await addDoc(entriesCol, { ...entry, createdAt: now });
        await updateDoc(docRef, { id: docRef.id });

        const userDoc = doc(this.firestore, `users/${u.uid}`);
        const patch: Record<string, any> = {};

        if (entry.status === 'visited') {
            patch['visitedCountries'] = arrayUnion(entry.countryId);
        } else {
            patch['plannedCountries'] = arrayUnion(entry.countryId);
        }

        // Dual-write subdivision / heritage caches
        if (entry.subdivisions?.length) {
            patch['visitedSubdivisions'] = arrayUnion(...entry.subdivisions);
        }
        if (entry.heritageSites?.length) {
            patch['visitedPOIs'] = arrayUnion(...entry.heritageSites);
        }

        await updateDoc(userDoc, patch);
    }

    /** Live stream of a user's travel entries, newest first */
    getTravelEntries(uid: string): Observable<TravelEntry[]> {
        const entriesCol = collection(this.firestore, `users/${uid}/travelEntries`);
        return new Observable<TravelEntry[]>(observer => {
            const unsubscribe = onSnapshot(entriesCol, snap => {
                this.zone.run(() => {
                    const entries = snap.docs
                        .map(d => d.data() as TravelEntry)
                        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    observer.next(entries);
                });
            }, err => observer.error(err));
            return () => unsubscribe();
        });
    }

    /** Update an existing travel entry and sync user profile arrays + caches */
    async updateTravelEntry(
        uid: string,
        entryId: string,
        changes: Partial<Pick<TravelEntry, 'status' | 'date' | 'note' | 'rating' | 'subdivisions' | 'heritageSites' | 'needsDate'>>
    ): Promise<void> {
        const entryDocRef = doc(this.firestore, `users/${uid}/travelEntries/${entryId}`);
        const snap = await getDoc(entryDocRef);
        if (!snap.exists()) return;
        const entry = snap.data() as TravelEntry;

        await updateDoc(entryDocRef, changes as Record<string, any>);

        const userDoc = doc(this.firestore, `users/${uid}`);
        const newStatus = changes.status ?? entry.status;
        const patch: Record<string, any> = {};

        if (newStatus === 'visited') {
            patch['visitedCountries'] = arrayUnion(entry.countryId);
            if (entry.status === 'planned') {
                const allSnap = await getDocs(collection(this.firestore, `users/${uid}/travelEntries`));
                const stillPlanned = allSnap.docs
                    .map(d => d.data() as TravelEntry)
                    .some(e => e.countryId === entry.countryId && e.status === 'planned' && e.id !== entryId);
                if (!stillPlanned) patch['plannedCountries'] = arrayRemove(entry.countryId);
            }
        } else if (newStatus === 'planned') {
            patch['plannedCountries'] = arrayUnion(entry.countryId);
            if (entry.status === 'visited') {
                const allSnap = await getDocs(collection(this.firestore, `users/${uid}/travelEntries`));
                const stillVisited = allSnap.docs
                    .map(d => d.data() as TravelEntry)
                    .some(e => e.countryId === entry.countryId && e.status === 'visited' && e.id !== entryId);
                if (!stillVisited) patch['visitedCountries'] = arrayRemove(entry.countryId);
            }
        }

        // Dual-write new subdivisions/heritage into caches
        if (changes.subdivisions?.length) {
            patch['visitedSubdivisions'] = arrayUnion(...changes.subdivisions);
        }
        if (changes.heritageSites?.length) {
            patch['visitedPOIs'] = arrayUnion(...changes.heritageSites);
        }

        if (Object.keys(patch).length) await updateDoc(userDoc, patch);
    }

    /** Delete a travel entry. Re-syncs country flags and recomputes subdivision/heritage caches. */
    async deleteTravelEntry(uid: string, entryId: string): Promise<void> {
        const entryDocRef = doc(this.firestore, `users/${uid}/travelEntries/${entryId}`);
        const snap = await getDoc(entryDocRef);
        if (!snap.exists()) return;
        const entry = snap.data() as TravelEntry;
        await deleteDoc(entryDocRef);

        const entriesCol = collection(this.firestore, `users/${uid}/travelEntries`);
        const allSnap = await getDocs(entriesCol);
        const allEntries = allSnap.docs.map(d => d.data() as TravelEntry);
        const remaining = allEntries.filter(e => e.countryId === entry.countryId);

        const userDoc = doc(this.firestore, `users/${uid}`);
        const patch: Record<string, any> = {};

        if (!remaining.some(e => e.status === 'visited')) patch['visitedCountries'] = arrayRemove(entry.countryId);
        if (!remaining.some(e => e.status === 'planned')) patch['plannedCountries'] = arrayRemove(entry.countryId);

        // Recompute visited subdivisions and heritage from all remaining entries
        const allSubdivisions = allEntries.flatMap(e => e.subdivisions || []);
        const allHeritage = allEntries.flatMap(e => e.heritageSites || []);
        patch['visitedSubdivisions'] = allSubdivisions;
        patch['visitedPOIs'] = allHeritage;

        await updateDoc(userDoc, patch);
    }

    /** @deprecated Use addTravelEntry with heritageSites[] instead. Kept temporarily for compatibility. */
    async markPOIVisited(poiId: string, visited: boolean, countryId?: string) {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDoc = doc(this.firestore, `users/${u.uid}`);
        if (visited) {
            const update: any = { visitedPOIs: arrayUnion(poiId) };
            if (countryId) update.visitedCountries = arrayUnion(countryId);
            await updateDoc(userDoc, update);
        } else {
            await updateDoc(userDoc, { visitedPOIs: arrayRemove(poiId) });
        }
    }

    /** Set (or clear) the user's home country */
    async setHomeCountry(countryId: string | null): Promise<void> {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDoc = doc(this.firestore, `users/${u.uid}`);
        await updateDoc(userDoc, { homeCountryId: countryId ?? deleteField() });
    }

    /** Heartbeat — write current timestamp to lastLoginAt so "last online" stays fresh */
    async updateLastSeen(): Promise<void> {
        try {
            const u = this.auth.currentUser;
            if (!u) return;
            const userDoc = doc(this.firestore, `users/${u.uid}`);
            await updateDoc(userDoc, { lastLoginAt: new Date().toISOString() });
        } catch {
            // Silently ignore — document may not exist yet on first load
        }
    }

    // Data Retrieval
    getCountries(): Observable<Country[]> {
        const countriesCol = collection(this.firestore, 'countries');
        return new Observable<Country[]>(observer => {
            getDocs(countriesCol).then(snapshot => {
                const countries = snapshot.docs.map(doc => doc.data() as Country);
                observer.next(countries.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            });
        });
    }

    getPOIs(): Observable<POI[]> {
        const poisCol = collection(this.firestore, 'pois');
        return new Observable<POI[]>(observer => {
            getDocs(poisCol).then(snapshot => {
                observer.next(snapshot.docs.map(doc => doc.data() as POI));
            });
        });
    }

    getContinents(): Observable<Continent[]> {
        const continentsCol = collection(this.firestore, 'continents');
        return new Observable<Continent[]>(observer => {
            getDocs(continentsCol).then(snapshot => {
                const continents = snapshot.docs.map(doc => doc.data() as Continent);
                observer.next(continents.sort((a, b) => a.name.localeCompare(b.name)));
            });
        });
    }

    // --- Deletion Helpers ---

    async deleteCollection(collectionPath: string): Promise<number> {
        const colRef = collection(this.firestore, collectionPath);
        const snapshot = await getDocs(colRef);
        const batchSize = 100;
        let batch = writeBatch(this.firestore);
        let count = 0;

        for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
            count++;
            if (count % batchSize === 0) {
                await batch.commit();
                batch = writeBatch(this.firestore);
            }
        }

        if (count % batchSize !== 0) {
            await batch.commit();
        }

        return count;
    }

    async wipeAllCountryData(onLog?: (msg: string) => void): Promise<void> {
        const log = onLog || (() => { });

        log('Deleting all countries...');
        const deletedCountries = await this.deleteCollection('countries');
        log(`Deleted ${deletedCountries} countries.`);

        log('All country data wiped.');
    }

    async resetAllUserData(onLog?: (msg: string) => void): Promise<void> {
        const log = onLog || (() => { });
        const usersCol = collection(this.firestore, 'users');
        const snapshot = await getDocs(usersCol);
        let count = 0;

        log('Resetting all users\' visited data...');
        for (const userSnap of snapshot.docs) {
            await updateDoc(userSnap.ref, {
                visitedCountries: [],
                plannedCountries: [],
                visitedSubdivisions: [],
                dataResetNotification: true
            });
            count++;
        }

        log(`Reset visited data for ${count} users. They will see a notification on next login.`);
    }

    async clearResetNotification(): Promise<void> {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDocRef = doc(this.firestore, `users/${u.uid}`);
        await updateDoc(userDocRef, { dataResetNotification: false });
    }

    // --- Seeding ---

    async seedCountries(jsonContent: string, onLog?: (msg: string) => void) {
        const countriesData = JSON.parse(jsonContent) as Record<string, any>;
        const log = onLog || (() => { });

        let countryCount = 0;

        for (const [isoCode, item] of Object.entries(countriesData)) {
            if (!isoCode || !item.name) continue;

            const continent = item.region || 'Unknown';

            // Build subdivisions array from embedded data
            // subdivisions can be an object keyed by division type (e.g. { "entity": [...], "district": [...] })
            // or a flat array for backward compatibility
            let rawSubs: any[] = [];
            if (item.subdivisions) {
                if (Array.isArray(item.subdivisions)) {
                    rawSubs = item.subdivisions;
                } else if (typeof item.subdivisions === 'object') {
                    // Flatten all subdivision arrays from the grouped object
                    for (const divisionType of Object.keys(item.subdivisions)) {
                        const group = item.subdivisions[divisionType];
                        if (Array.isArray(group)) {
                            rawSubs.push(...group);
                        }
                    }
                }
            }
            const subdivisions: Subdivision[] = rawSubs.map((sub: any) => ({
                code: sub.code,
                name: sub.name,
                division: sub.division || '',
                parent: sub.parent || isoCode,
                lat: sub.lat ?? null,
                lng: sub.lng ?? null
            }));

            const country: Country = {
                id: isoCode,
                name: item.name,
                latitude: item.lat ?? (item.latitude ? parseFloat(item.latitude) : 0),
                longitude: item.lng ?? (item.longitude ? parseFloat(item.longitude) : 0),
                continent: continent,
                region: item.subregion || '',
                capital: item.capital || '',
                emoji: item.emoji || '',
                native: item.native || '',
                iso3: item.iso3 || '',
                population: item.population ?? null,
                gdp: item.gdp ?? null,
                currency: item.currency || '',
                currency_name: item.currency_name || '',
                currency_symbol: item.currency_symbol || '',
                nationality: item.nationality || '',
                area_sq_km: item.area_sq_km ?? null,
                translations: item.translations || {},
                subdivisions: subdivisions,
                worldHeritageSites: item.worldHeritageSites || []
            };

            await setDoc(doc(this.firestore, `countries/${country.id}`), country);
            countryCount++;
        }

        log(`Seeded ${countryCount} countries.`);
    }

    getSubdivisions(countryId: string): Observable<Subdivision[]> {
        // Get subdivisions from the country document itself
        const countryDocRef = doc(this.firestore, `countries/${countryId}`);
        return new Observable<Subdivision[]>(observer => {
            const unsubscribe = onSnapshot(countryDocRef, (snapshot) => {
                this.zone.run(() => {
                    if (snapshot.exists()) {
                        const data = snapshot.data() as Country;
                        const subs = (data.subdivisions || []).sort((a, b) => a.name.localeCompare(b.name));
                        observer.next(subs);
                    } else {
                        observer.next([]);
                    }
                });
            }, error => {
                console.error('Error fetching subdivisions:', error);
                observer.error(error);
            });
            return () => unsubscribe();
        });
    }

    /** @deprecated Subdivisions are now managed through TravelEntry.subdivisions[]. */
    async toggleSubdivisionVisited(subdivisionId: string, profile: UserProfile | null, countryId?: string) {
        if (!profile) return;
        const userDocRef = doc(this.firestore, `users/${profile.uid}`);
        const isVisited = profile.visitedSubdivisions?.includes(subdivisionId);
        if (isVisited) {
            await updateDoc(userDocRef, { visitedSubdivisions: arrayRemove(subdivisionId) });
        } else {
            const update: any = { visitedSubdivisions: arrayUnion(subdivisionId) };
            if (countryId) update.visitedCountries = arrayUnion(countryId);
            await updateDoc(userDocRef, update);
        }
    }

    // ── Migration ────────────────────────────────────────────────────────────

    /**
     * Migrates legacy data for a single user:
     * 1. Truncates full YYYY-MM-DD dates to YYYY-MM.
     * 2. Creates real TravelEntry documents for countries in visitedCountries/plannedCountries
     *    that have no corresponding subcollection entry (sets needsDate: true, date: '').
     * 3. Rebuilds visitedSubdivisions and visitedPOIs caches from entry data.
     */
    async migrateLegacyEntries(uid: string, onLog?: (msg: string) => void): Promise<void> {
        const log = onLog || (() => {});
        const entriesCol = collection(this.firestore, `users/${uid}/travelEntries`);
        const userDocRef = doc(this.firestore, `users/${uid}`);

        // 1. Fetch current entries
        const entriesSnap = await getDocs(entriesCol);
        const existingEntries = entriesSnap.docs.map(d => ({ ref: d.ref, data: d.data() as TravelEntry }));

        // 2. Truncate YYYY-MM-DD → YYYY-MM
        let migrated = 0;
        for (const { ref, data } of existingEntries) {
            if (data.date && data.date.length === 10) {
                const newDate = data.date.substring(0, 7);
                await updateDoc(ref, { date: newDate });
                migrated++;
            }
        }
        log(`Date truncation: ${migrated} entries updated.`);

        // 3. Create phantom entries for legacy country IDs with no entry
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) { log('User doc not found, skipping.'); return; }
        const profile = userSnap.data() as UserProfile;

        const coveredIds = new Set(existingEntries.map(e => e.data.countryId));
        const now = new Date().toISOString();
        let phantoms = 0;

        for (const countryId of (profile.visitedCountries || [])) {
            if (!coveredIds.has(countryId)) {
                await addDoc(entriesCol, {
                    countryId, countryName: countryId, status: 'visited',
                    date: '', needsDate: true, createdAt: now, subdivisions: [], heritageSites: []
                } as Omit<TravelEntry, 'id'>);
                phantoms++;
            }
        }
        for (const countryId of (profile.plannedCountries || [])) {
            if (!coveredIds.has(countryId)) {
                await addDoc(entriesCol, {
                    countryId, countryName: countryId, status: 'planned',
                    date: '', needsDate: true, createdAt: now, subdivisions: [], heritageSites: []
                } as Omit<TravelEntry, 'id'>);
                phantoms++;
            }
        }
        log(`Phantom entries created: ${phantoms}.`);

        // 4. Rebuild flat subdivision/heritage caches from entries
        const refreshed = await getDocs(entriesCol);
        const allEntries = refreshed.docs.map(d => d.data() as TravelEntry);
        const allSubs = [...new Set(allEntries.flatMap(e => e.subdivisions || []))];
        const allPOIs = [...new Set(allEntries.flatMap(e => e.heritageSites || []))];
        await updateDoc(userDocRef, { visitedSubdivisions: allSubs, visitedPOIs: allPOIs });
        log(`Caches rebuilt: ${allSubs.length} subdivisions, ${allPOIs.length} heritage sites.`);
    }

    /** Update scalar fields on a country document (does not touch subdivisions / worldHeritageSites arrays) */
    async updateCountry(countryId: string, changes: Partial<Record<string, any>>): Promise<void> {
        const countryDocRef = doc(this.firestore, `countries/${countryId}`);
        await updateDoc(countryDocRef, changes);
    }

    /** Fetch a single country document by ID */
    async getCountryById(countryId: string): Promise<any | null> {
        const { getDoc } = await import('@angular/fire/firestore');
        const countryDocRef = doc(this.firestore, `countries/${countryId}`);
        const snap = await getDoc(countryDocRef);
        return snap.exists() ? snap.data() : null;
    }

    /** Admin: fetch all user profiles (all users, including those without usernames) */
    async getAllUsers(): Promise<UserProfile[]> {
        const usersCol = collection(this.firestore, 'users');
        const snap = await getDocs(usersCol);
        return snap.docs
            .map(d => d.data() as UserProfile)
            .sort((a, b) => (a.username || a.displayName || a.email || '').localeCompare(b.username || b.displayName || b.email || ''));
    }

    /** Admin: update editable profile fields for any user */
    async updateUserProfile(uid: string, changes: Partial<Pick<UserProfile, 'displayName' | 'email'>>): Promise<void> {
        const userDocRef = doc(this.firestore, `users/${uid}`);
        await updateDoc(userDocRef, changes as Record<string, any>);
    }

    // ── Username methods ──────────────────────────────────────

    /** Check whether a username is available (case-insensitive) */
    async checkUsernameAvailable(username: string): Promise<boolean> {
        const normalized = username.toLowerCase().trim();
        if (!normalized) return false;
        const usernameDoc = doc(this.firestore, `usernames/${normalized}`);
        const snap = await getDoc(usernameDoc);
        return !snap.exists();
    }

    /**
     * Atomically claim a username for a user.
     * - Writes usernames/{newUsername} → { uid }
     * - Updates users/{uid} → { username: newUsername }
     * - Deletes usernames/{oldUsername} if provided
     */
    async setUsername(uid: string, newUsername: string, oldUsername?: string): Promise<void> {
        const normalized = newUsername.toLowerCase().trim();
        const batch = writeBatch(this.firestore);

        // Claim the new username
        const newUsernameDoc = doc(this.firestore, `usernames/${normalized}`);
        batch.set(newUsernameDoc, { uid });

        // Update the user document
        const userDocRef = doc(this.firestore, `users/${uid}`);
        batch.update(userDocRef, { username: normalized });

        // Release the old username
        if (oldUsername) {
            const oldUsernameDoc = doc(this.firestore, `usernames/${oldUsername.toLowerCase().trim()}`);
            batch.delete(oldUsernameDoc);
        }

        await batch.commit();
    }

    /** Look up a user profile by username (via the usernames index collection) */
    async getUserByUsername(username: string): Promise<UserProfile | null> {
        const normalized = username.toLowerCase().trim();
        const usernameDoc = doc(this.firestore, `usernames/${normalized}`);
        const usernameSnap = await getDoc(usernameDoc);
        if (!usernameSnap.exists()) return null;

        const { uid } = usernameSnap.data() as { uid: string };
        const userDocRef = doc(this.firestore, `users/${uid}`);
        const userSnap = await getDoc(userDocRef);
        return userSnap.exists() ? (userSnap.data() as UserProfile) : null;
    }
}

