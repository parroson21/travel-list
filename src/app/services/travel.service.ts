import { Injectable, NgZone } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { POI, Country, UserProfile, Continent } from '../models/travel.model';
import { switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import * as Papa from 'papaparse';

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
                                const newProfile: UserProfile = { uid: u.uid, visitedCountries: [], visitedPOIs: [] };
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
    async seedCountries(csvContent: string, coordsCsvContent: string) {
        const metadataResults = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        const coordsResults = Papa.parse(coordsCsvContent, { header: true, skipEmptyLines: true });

        const coordsMap = new Map<string, { lat: number, lng: number }>();
        for (const row of coordsResults.data as any[]) {
            if (row.country && row.latitude && row.longitude) {
                coordsMap.set(row.country, {
                    lat: parseFloat(row.latitude),
                    lng: parseFloat(row.longitude)
                });
            }
        }

        // Collect unique continents while seeding countries
        const continentsSet = new Set<string>();

        for (const row of metadataResults.data as any[]) {
            // Use 'id' or 'iso2' from countries.csv as the lookup key
            const isoCode = row.id || row.iso2;
            if (isoCode && row.country) {
                const coords = coordsMap.get(isoCode);
                const continent = row.continent || 'Unknown';

                const country: Country = {
                    id: isoCode,
                    name: row.country,
                    latitude: coords ? coords.lat : 0,
                    longitude: coords ? coords.lng : 0,
                    region: continent
                };

                if (coords) {
                    await setDoc(doc(this.firestore, `countries/${country.id}`), country);
                } else {
                    console.warn(`No coordinates found for ${country.name} (${country.id})`);
                    await setDoc(doc(this.firestore, `countries/${country.id}`), country);
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

    async seedContinents() {
        const continents = [
            { id: 'africa', name: 'Africa' },
            { id: 'asia', name: 'Asia' },
            { id: 'europe', name: 'Europe' },
            { id: 'north-america', name: 'North America' },
            { id: 'oceania', name: 'Oceania' },
            { id: 'south-america', name: 'South America' }
        ];

        for (const continent of continents) {
            await setDoc(doc(this.firestore, `continents/${continent.id}`), continent);
        }
    }

    async seedPOIs(csvContent: string) {
        const results = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        const updatedCountries = new Set<string>();

        for (const row of results.data as any[]) {
            if (row.id_no && row.name_en) {
                const poi: POI = {
                    id: row.id_no,
                    name: row.name_en,
                    description: row.short_description_en || '',
                    latitude: parseFloat(row.latitude),
                    longitude: parseFloat(row.longitude),
                    category: row.category,
                    country: row.states_name_en,
                    isoCode: row.iso_code,
                    region: row.region_en
                };
                await setDoc(doc(this.firestore, `pois/${poi.id}`), poi);

                // Update Country Region if not already done
                if (poi.isoCode && poi.region && !updatedCountries.has(poi.isoCode)) {
                    const countryRef = doc(this.firestore, `countries/${poi.isoCode}`);
                    await setDoc(countryRef, { region: poi.region }, { merge: true });
                    updatedCountries.add(poi.isoCode);
                }
            }
        }
    }
}
