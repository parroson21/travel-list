import { Injectable, NgZone } from '@angular/core';
import { POI, Country, UserProfile, Continent, Subdivision } from '../models/travel.model';
import { Firestore, collection, doc, setDoc, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot, query, where, collectionData, writeBatch } from '@angular/fire/firestore';
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

    // Seeding
    async seedCountries(jsonContent: string) {
        const countriesData = JSON.parse(jsonContent) as any[];

        // Collect unique continents while seeding countries
        const continentsSet = new Set<string>();

        for (const item of countriesData) {
            const isoCode = item.iso2;
            if (isoCode && item.name) {
                const continent = item.region || 'Unknown';

                const country: Country = {
                    id: isoCode,
                    name: item.name,
                    latitude: item.latitude ? parseFloat(item.latitude) : 0,
                    longitude: item.longitude ? parseFloat(item.longitude) : 0,
                    continent: continent,
                    region: item.subregion || '',
                    capital: item.capital || '',
                    emoji: item.emoji || '',
                    native: item.native || '',
                    hasStates: false,
                    worldHeritageSites: item.worldHeritageSites || []
                };

                await setDoc(doc(this.firestore, `countries/${country.id}`), country);

                // Also seed the Individual POIs (Heritage Sites)
                if (item.worldHeritageSites && Array.isArray(item.worldHeritageSites)) {
                    for (const site of item.worldHeritageSites) {
                        const poi: POI = {
                            id: site.id_no,
                            name: site.name_en,
                            description: site.short_description_en || '',
                            latitude: site.latitude ? parseFloat(site.latitude) : 0,
                            longitude: site.longitude ? parseFloat(site.longitude) : 0,
                            category: site.category || '',
                            country: site.states_name_en || '',
                            isoCode: site.iso_code || '',
                            region: site.region_en || ''
                        };
                        await setDoc(doc(this.firestore, `pois/${poi.id}`), poi);
                    }
                }

                // Add continent to set
                if (continent && continent !== 'Unknown') {
                    continentsSet.add(continent);
                }
            }
        }

        // Seed continents
        for (const continentName of continentsSet) {
            const continent: Continent = {
                id: continentName.toLowerCase().replace(/\s+/g, '-'),
                name: continentName
            };
            await setDoc(doc(this.firestore, `continents/${continent.id}`), continent);
        }
    }

    async seedSubdivisions(jsonContent: string) {
        const statesData = JSON.parse(jsonContent) as any[];
        const batchSize = 100;
        let batch = writeBatch(this.firestore);
        let count = 0;

        const countryStateMap = new Set<string>();

        for (const item of statesData) {
            const countryCode = item.country_code;
            const stateCode = item.iso2;
            const stateId = item.iso3166_2 || `${countryCode}-${stateCode}`;

            if (countryCode && stateCode && item.name) {
                const subdivision: Subdivision = {
                    id: stateId,
                    name: item.name,
                    countryId: countryCode,
                    latitude: item.latitude ? parseFloat(item.latitude) : 0,
                    longitude: item.longitude ? parseFloat(item.longitude) : 0
                };

                const stateDoc = doc(this.firestore, `subdivisions/${subdivision.id}`);
                batch.set(stateDoc, subdivision);
                countryStateMap.add(countryCode);
                count++;

                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = writeBatch(this.firestore);
                }
            }
        }

        if (count % batchSize !== 0) {
            await batch.commit();
        }

        // Update countries to mark they have states
        for (const countryCode of countryStateMap) {
            const countryDoc = doc(this.firestore, `countries/${countryCode}`);
            await updateDoc(countryDoc, { hasStates: true });
        }
    }

    getSubdivisions(countryId: string): Observable<Subdivision[]> {
        const subdivisionsRef = collection(this.firestore, 'subdivisions');
        const q = query(subdivisionsRef, where('countryId', '==', countryId));
        return new Observable<Subdivision[]>(observer => {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                this.zone.run(() => {
                    const subs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subdivision));
                    observer.next(subs);
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
