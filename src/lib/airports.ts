import { promises as fs } from 'fs';
import path from 'path';

export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  info?: string;
}

export interface CityGroup {
  city: string;
  country: string;
  airports: Airport[];
  isMultiAirport: boolean;
}

export interface SearchResult {
  type: 'airport' | 'city';
  airport?: Airport;
  cityGroup?: CityGroup;
  displayName: string;
}

let airportsCache: Airport[] | null = null;

/**
 * Load airports from CSV file
 */
async function loadAirports(): Promise<Airport[]> {
  if (airportsCache) {
    return airportsCache;
  }

  try {
    const csvPath = path.join(process.cwd(), 'data', 'airports.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    
    const lines = fileContent.split('\n').slice(1); // Skip header
    const airports: Airport[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
      
      if (columns.length >= 6) {
        const [iata, icao, name, country, city, info] = columns;
        
        if (iata && name && city && country) {
          airports.push({
            iata,
            icao,
            name,
            city,
            country,
            info: info || undefined
          });
        }
      }
    }

    airportsCache = airports;
    return airports;
  } catch (error) {
    console.error('Error loading airports:', error);
    return [];
  }
}

/**
 * Group airports by city for multi-airport cities
 */
function groupAirportsByCity(airports: Airport[]): Map<string, CityGroup> {
  const cityGroups = new Map<string, CityGroup>();

  for (const airport of airports) {
    const cityKey = `${airport.city}, ${airport.country}`.toLowerCase();
    
    if (!cityGroups.has(cityKey)) {
      cityGroups.set(cityKey, {
        city: airport.city,
        country: airport.country,
        airports: [],
        isMultiAirport: false
      });
    }

    const group = cityGroups.get(cityKey)!;
    group.airports.push(airport);
  }

  // Mark cities with multiple airports
  for (const group of cityGroups.values()) {
    group.isMultiAirport = group.airports.length > 1;
  }

  return cityGroups;
}

/**
 * Search airports and cities
 */
export async function searchAirports(query: string, limit: number = 10): Promise<SearchResult[]> {
  const airports = await loadAirports();
  const cityGroups = groupAirportsByCity(airports);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const queryLower = query.toLowerCase();

  // First, search for cities (but ONLY if they have multiple airports)
  for (const group of cityGroups.values()) {
    if (results.length >= limit) break;

    // Only show city group if it has multiple airports
    if (!group.isMultiAirport) continue;

    const cityName = group.city.toLowerCase();
    const countryName = group.country.toLowerCase();
    const cityKey = `${group.city}, ${group.country}`;

    if (seen.has(cityKey)) continue;

    // Match by city name or country
    if (cityName.includes(queryLower) || countryName.includes(queryLower)) {
      results.push({
        type: 'city',
        cityGroup: group,
        displayName: `${group.city}, ${group.country} (All Airports)`
      });
      seen.add(cityKey);
    }
  }

  // Then search for individual airports
  for (const airport of airports) {
    if (results.length >= limit) break;

    const airportKey = `${airport.iata}_${airport.city}`;
    if (seen.has(airportKey)) continue;

    const airportName = airport.name.toLowerCase();
    const cityName = airport.city.toLowerCase();
    const iataCode = airport.iata.toLowerCase();
    const icaoCode = airport.icao.toLowerCase();

    // Match by airport name, city, or IATA/ICAO code
    if (
      airportName.includes(queryLower) ||
      cityName.includes(queryLower) ||
      iataCode.includes(queryLower) ||
      icaoCode.includes(queryLower)
    ) {
      results.push({
        type: 'airport',
        airport,
        displayName: `${airport.name} (${airport.iata})`
      });
      seen.add(airportKey);
    }
  }

  // Sort results: multi-airport cities first, then individual airports
  return results.sort((a, b) => {
    if (a.type === 'city' && b.type === 'airport') return -1;
    if (a.type === 'airport' && b.type === 'city') return 1;
    return 0;
  }).slice(0, limit);
}

/**
 * Get airport by IATA code
 */
export async function getAirportByCode(iataCode: string): Promise<Airport | null> {
  const airports = await loadAirports();
  return airports.find(airport => 
    airport.iata.toLowerCase() === iataCode.toLowerCase()
  ) || null;
}

/**
 * Get all airports in a city
 */
export async function getAirportsByCity(cityName: string, countryName: string): Promise<Airport[]> {
  const airports = await loadAirports();
  return airports.filter(airport => 
    airport.city.toLowerCase() === cityName.toLowerCase() &&
    airport.country.toLowerCase() === countryName.toLowerCase()
  );
}

/**
 * Get statistics about the airport database
 */
export async function getAirportStats(): Promise<{
  totalAirports: number;
  totalCities: number;
  totalCountries: number;
  multiAirportCities: number;
}> {
  const airports = await loadAirports();
  const cityGroups = groupAirportsByCity(airports);
  
  const countries = new Set(airports.map(a => a.country));
  const multiAirportCities = Array.from(cityGroups.values())
    .filter(group => group.isMultiAirport).length;

  return {
    totalAirports: airports.length,
    totalCities: cityGroups.size,
    totalCountries: countries.size,
    multiAirportCities
  };
}
