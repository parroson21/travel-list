export interface POI {
    id: string;
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    category: string;
    country: string;
    isoCode: string;
    region: string;
}

export interface Country {
    id: string; // ISO Code (iso2)
    name: string;
    latitude: number;
    longitude: number;
    continent: string; // Maps to 'region' in JSON
    region: string; // Maps to 'subregion' in JSON
    capital: string;
    emoji: string;
    native: string;
    hasStates?: boolean;
}

export interface Subdivision {
    id: string; // Format: country_code-iso2 (e.g., US-CA)
    name: string;
    countryId: string;
    latitude: number;
    longitude: number;
}

export interface UserProfile {
    uid: string;
    visitedCountries: string[]; // List of country IDs
    visitedSubdivisions: string[]; // List of subdivision IDs
    visitedPOIs: string[]; // List of POI IDs
}

export interface Continent {
    id: string;
    name: string;
}
