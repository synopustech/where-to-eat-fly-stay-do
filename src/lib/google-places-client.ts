/**
 * Google Places API (New) HTTP Client
 * 
 * This uses the new Google Places API which provides:
 * - Better performance with field masks
 * - Enhanced search capabilities  
 * - More efficient data retrieval
 * - Better cost optimization (pay only for fields you need)
 * 
 * Migration from legacy Places API completed: August 2025
 */

const GOOGLE_PLACES_API_BASE_URL = 'https://places.googleapis.com/v1';

// Helper function to convert legacy location format to new API format
export function formatLocationForNewAPI(lat: number, lng: number) {
  return {
    latitude: lat,
    longitude: lng
  };
}

// Helper function to convert legacy radius to new API circle format
export function formatRadiusForNewAPI(lat: number, lng: number, radius: number) {
  return {
    center: formatLocationForNewAPI(lat, lng),
    radius: radius
  };
}

// Field masks for different types of requests
export const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress', 
  'places.location',
  'places.rating',
  'places.priceLevel',
  'places.photos',
  'places.types',
  'places.businessStatus',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.primaryType',
  'places.primaryTypeDisplayName'
].join(',');

export const DETAILS_FIELD_MASK = [
  'id',
  'displayName', 
  'formattedAddress',
  'nationalPhoneNumber',
  'websiteUri',
  'rating',
  'location',
  'currentOpeningHours',
  'regularOpeningHours',
  'priceLevel',
  'photos',
  'reviews',
  'businessStatus',
  'types',
  'primaryType',
  'primaryTypeDisplayName'
].join(',');

// New Places API client using direct HTTP calls
export const placesClient = {
  async searchText(request: {
    textQuery: string;
    fieldMask: string;
    locationBias?: {
      circle: {
        center: { latitude: number; longitude: number };
        radius: number;
      };
    };
    includedType?: string;
  }) {
    const response = await fetch(`${GOOGLE_PLACES_API_BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY || '',
        'X-Goog-FieldMask': request.fieldMask,
      },
      body: JSON.stringify({
        textQuery: request.textQuery,
        locationBias: request.locationBias,
        includedType: request.includedType,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Places API Error:', response.status, response.statusText, errorText);
      throw new Error(`Places API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  },

  async getPlace(request: {
    name: string;
    fieldMask: string;
  }) {
    const response = await fetch(`${GOOGLE_PLACES_API_BASE_URL}/${request.name}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY || '',
        'X-Goog-FieldMask': request.fieldMask,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Places API GetPlace Error:', response.status, response.statusText, errorText);
      throw new Error(`Places API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  }
};
