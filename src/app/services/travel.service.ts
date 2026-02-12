import { Injectable, NgZone } from '@angular/core';
import { POI, Country, UserProfile, Continent, Subdivision } from '../models/travel.model';
import { Firestore, collection, doc, setDoc, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot, query, where, collectionData, writeBatch, deleteDoc } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TravelService {
    constructor(private firestore: Firestore, private auth: Auth, private zone: NgZone) { }

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
                                observer.next(snapshot.data() as UserProfile);
                            } else {
                                const newProfile: UserProfile = {
                                    uid: u.uid,
                                    visitedCountries: [],
                                    visitedSubdivisions: [],
                                    visitedPOIs: []
                                };
                                setDoc(userDoc, newProfile);
                            }
                        });
                    }, error => observer.error(error));
                    return () => unsubscribe();
                });
            })
        );
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

    async markPOIVisited(poiId: string, visited: boolean) {
        const u = this.auth.currentUser;
        if (!u) return;
        const userDoc = doc(this.firestore, `users/${u.uid}`);
        if (visited) {
            await updateDoc(userDoc, { visitedPOIs: arrayUnion(poiId) });
        } else {
            await updateDoc(userDoc, { visitedPOIs: arrayRemove(poiId) });
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
        const log = onLog || (() => {});

        log('Deleting all countries...');
        const deletedCountries = await this.deleteCollection('countries');
        log(`Deleted ${deletedCountries} countries.`);

        log('All country data wiped.');
    }

    async resetAllUserData(onLog?: (msg: string) => void): Promise<void> {
        const log = onLog || (() => {});
        const usersCol = collection(this.firestore, 'users');
        const snapshot = await getDocs(usersCol);
        let count = 0;

        log('Resetting all users\' visited data...');
        for (const userSnap of snapshot.docs) {
            await updateDoc(userSnap.ref, {
                visitedCountries: [],
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
        const log = onLog || (() => {});

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

    async toggleSubdivisionVisited(subdivisionId: string, profile: UserProfile | null) {
        if (!profile) return;

        const userDocRef = doc(this.firestore, `users/${profile.uid}`);
        const isVisited = profile.visitedSubdivisions?.includes(subdivisionId);

        if (isVisited) {
            await updateDoc(userDocRef, {
                visitedSubdivisions: arrayRemove(subdivisionId)
            });
        } else {
            await updateDoc(userDocRef, {
                visitedSubdivisions: arrayUnion(subdivisionId)
            });
        }
    }
}
