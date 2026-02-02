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
    id: string; // ISO Code
    name: string;
    latitude: number;
    longitude: number;
    region?: string;
}

export interface UserProfile {
    uid: string;
    visitedCountries: string[]; // List of country IDs
    visitedPOIs: string[]; // List of POI IDs
}
