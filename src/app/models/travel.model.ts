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
    id: string; // ISO2 code (e.g., "AD")
    name: string;
    latitude: number;
    longitude: number;
    continent: string; // Maps to 'region' in JSON
    region: string; // Maps to 'subregion' in JSON
    capital: string;
    emoji: string;
    native: string;
    subdivisions?: Subdivision[];
    worldHeritageSites?: any[];
    // Additional fields from merged format
    iso3?: string;
    population?: number;
    gdp?: number | null;
    currency?: string;
    currency_name?: string;
    currency_symbol?: string;
    nationality?: string;
    area_sq_km?: number;
    translations?: Record<string, string>;
}

export interface Subdivision {
    code: string; // e.g., "AD-07"
    name: string;
    division: string; // e.g., "parish", "province", "state"
    parent: string; // parent country code, e.g., "AD"
    lat?: number;
    lng?: number;
}

export interface UserProfile {
    uid: string;
    visitedCountries: string[]; // List of country IDs
    visitedSubdivisions: string[]; // List of subdivision codes
    visitedPOIs: string[]; // List of POI IDs
    dataResetNotification?: boolean; // Set to true when admin resets user data
}

export interface Continent {
    id: string;
    name: string;
}
