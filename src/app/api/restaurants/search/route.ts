import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { googleMapsClient } from '@/lib/google-maps-client';
import { placesClient, SEARCH_FIELD_MASK, DETAILS_FIELD_MASK, formatLocationForNewAPI } from '@/lib/google-places-client';
import dbConnect from '@/lib/mongodb';
import SearchHistory from '@/models/SearchHistory';
import PopularKeyword from '@/models/PopularKeyword';

// Types for Google Places API responses
interface PlaceLocation {
  latitude: number;
  longitude: number;
}

interface PlaceOpeningHours {
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

interface PlaceReview {
  text?: string;
}

interface PlaceFromSearch {
  id: string;
  displayName?: { text: string };
  location?: PlaceLocation;
  regularOpeningHours?: PlaceOpeningHours;
  currentOpeningHours?: PlaceOpeningHours;
  businessStatus?: string;
  reviews?: PlaceReview[];
}

interface LocationBias {
  circle: {
    center: {
      latitude: number;
      longitude: number;
    };
    radius: number;
  };
}

interface SearchRequest {
  textQuery: string;
  fieldMask: string;
  locationBias?: LocationBias;
  includedType?: string;
}

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Helper function to extract and update keywords in database
async function updateKeywords(preferences: string) {
  if (!preferences) return;

  try {
    // Skip database operations during build time or if no valid URI
    if (!process.env.MONGODB_URI || 
        process.env.MONGODB_URI.includes('dummy')) {
      console.warn('Skipping keyword update - no valid MongoDB URI');
      return;
    }
    
    await dbConnect();

    const lowerPrefs = preferences.toLowerCase();
    
    // Enhanced cuisine detection
    const cuisineKeywords = {
      'italian': ['italian', 'pizza', 'pasta', 'spaghetti', 'lasagna', 'risotto'],
      'chinese': ['chinese', 'dim sum', 'dumplings', 'noodles', 'stir fry', 'fried rice'],
      'japanese': ['japanese', 'sushi', 'ramen', 'tempura', 'teriyaki', 'bento'],
      'thai': ['thai', 'pad thai', 'curry', 'tom yum', 'green curry', 'red curry'],
      'indian': ['indian', 'curry', 'biryani', 'tandoori', 'naan', 'masala'],
      'mexican': ['mexican', 'tacos', 'burritos', 'quesadilla', 'enchiladas', 'nachos'],
      'french': ['french', 'croissant', 'baguette', 'crepe', 'bistro', 'boeuf'],
      'american': ['american', 'burger', 'bbq', 'steak', 'ribs', 'wings'],
      'mediterranean': ['mediterranean', 'greek', 'hummus', 'falafel', 'gyros', 'kebab'],
      'korean': ['korean', 'kimchi', 'bulgogi', 'bibimbap', 'kbbq', 'korean bbq'],
      'vietnamese': ['vietnamese', 'pho', 'banh mi', 'spring rolls', 'bun bo hue'],
      'spanish': ['spanish', 'paella', 'tapas', 'sangria', 'churros'],
      'middle eastern': ['middle eastern', 'shawarma', 'kabab', 'lebanese', 'turkish']
    };
    
    const styleKeywords = {
      'fast food': ['fast food', 'quick', 'drive through', 'takeaway', 'grab and go'],
      'fine dining': ['fine dining', 'upscale', 'fancy', 'elegant', 'romantic', 'date night'],
      'casual dining': ['casual', 'family', 'relaxed', 'comfortable'],
      'cafe': ['cafe', 'coffee', 'breakfast', 'brunch', 'pastries'],
      'bar': ['bar', 'drinks', 'cocktails', 'beer', 'wine', 'happy hour'],
      'buffet': ['buffet', 'all you can eat', 'unlimited'],
      'food truck': ['food truck', 'street food', 'mobile']
    };
    
    const dietaryKeywords = ['vegetarian', 'vegan', 'gluten free', 'halal', 'kosher', 'keto', 'paleo'];

    // Update cuisine keywords
    for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
      if (keywords.some(keyword => lowerPrefs.includes(keyword))) {
        await PopularKeyword.findOneAndUpdate(
          { keyword: cuisine },
          { 
            $inc: { count: 1 },
            $set: { lastUsed: new Date(), category: 'cuisine' }
          },
          { upsert: true }
        );
      }
    }

    // Update style keywords
    for (const [style, keywords] of Object.entries(styleKeywords)) {
      if (keywords.some(keyword => lowerPrefs.includes(keyword))) {
        await PopularKeyword.findOneAndUpdate(
          { keyword: style },
          { 
            $inc: { count: 1 },
            $set: { lastUsed: new Date(), category: 'style' }
          },
          { upsert: true }
        );
      }
    }

    // Update dietary keywords
    for (const keyword of dietaryKeywords) {
      if (lowerPrefs.includes(keyword)) {
        await PopularKeyword.findOneAndUpdate(
          { keyword },
          { 
            $inc: { count: 1 },
            $set: { lastUsed: new Date(), category: 'dietary' }
          },
          { upsert: true }
        );
      }
    }

    // Extract other potential keywords (words longer than 3 characters)
    const words = preferences.split(/\s+/).filter(word => 
      word.length > 3 && !['restaurant', 'food', 'place'].includes(word.toLowerCase())
    );

    for (const word of words.slice(0, 3)) { // Limit to 3 additional keywords
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 3) {
        await PopularKeyword.findOneAndUpdate(
          { keyword: cleanWord },
          { 
            $inc: { count: 1 },
            $set: { lastUsed: new Date(), category: 'general' }
          },
          { upsert: true }
        );
      }
    }
  } catch {
    // Silent fail for background keyword updates
  }
}

// Helper function to save search history
async function saveSearchHistory(
  location: string,
  preferences: string,
  searchQuery: string,
  resultsCount: number,
  userCoords?: { lat: number; lng: number },
  request?: NextRequest
) {
  try {
    // Skip database operations during build time or if no valid URI
    if (!process.env.MONGODB_URI || 
        process.env.MONGODB_URI.includes('dummy')) {
      console.warn('Skipping search history save - no valid MongoDB URI');
      return;
    }
    
    await dbConnect();

    const searchData = {
      location,
      preferences,
      coordinates: userCoords,
      searchQuery,
      resultsCount,
      userAgent: request?.headers.get('user-agent') || undefined,
      // Note: In production, you might want to get real IP, but for demo we'll skip it
      // ipAddress: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || undefined,
    };

    await SearchHistory.create(searchData);
  } catch {
    // Silent fail for background search history save
  }
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

// Helper function to get timezone and local time for a location
async function getLocationTime(lat: number, lng: number): Promise<Date> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const timezoneResponse = await googleMapsClient.timezone({
      params: {
        location: `${lat},${lng}`,
        timestamp: timestamp,
        key: process.env.GOOGLE_PLACES_API_KEY!,
      },
    });

    if (timezoneResponse.data.status === 'OK') {
      const { dstOffset, rawOffset } = timezoneResponse.data;
      const totalOffsetSeconds = dstOffset + rawOffset; // Total offset in seconds from UTC
      
      // Create a new Date object representing the local time at the target location
      // We need to get the UTC time and then adjust it by the location's offset
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // Convert to true UTC
      const localTime = new Date(utcTime + (totalOffsetSeconds * 1000));
      
      return localTime;
    }
  } catch {
    // Fallback to current time if timezone API fails
  }
  
  // Fallback to current time if timezone API fails
  return new Date();
}

// Helper function to check if a restaurant is currently open (fallback for when Google doesn't provide open_now)
// Helper function to check if a restaurant is currently open (fallback for when Google doesn't provide open_now)
function isRestaurantOpen(openingHours?: string[], currentTime?: Date): boolean {
  if (!openingHours || openingHours.length === 0) {
    return false; // Assume closed if no hours provided (likely temporarily closed)
  }

  const now = currentTime || new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Google's weekday_text format: ["Monday: 9:00 AM – 9:00 PM", "Tuesday: 9:00 AM – 9:00 PM", ...]
  // Days are in order: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Helper function to parse time string and check if current time falls within range
  function checkTimeRange(hoursString: string): boolean {
    if (hoursString.toLowerCase().includes('closed')) {
      return false;
    }

    // Extract time range - handle various formats including "5 pm–4 am" and "8:30 am–5 pm"
    const timeMatch = hoursString.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    
    if (!timeMatch) {
      return false; // Assume closed if can't parse hours (was returning true)
    }

    const [, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = timeMatch;
    
    // Convert to minutes since midnight
    let openTimeInMinutes = parseInt(openHour) * 60 + parseInt(openMin || '0');
    let closeTimeInMinutes = parseInt(closeHour) * 60 + parseInt(closeMin || '0');
    
    // Handle AM/PM conversion
    if (openPeriod.toLowerCase() === 'pm' && parseInt(openHour) !== 12) {
      openTimeInMinutes += 12 * 60; // Add 12 hours for PM (except 12 PM)
    }
    if (openPeriod.toLowerCase() === 'am' && parseInt(openHour) === 12) {
      openTimeInMinutes = parseInt(openMin || '0'); // 12 AM = 00:xx
    }
    
    if (closePeriod.toLowerCase() === 'pm' && parseInt(closeHour) !== 12) {
      closeTimeInMinutes += 12 * 60; // Add 12 hours for PM (except 12 PM)
    }
    if (closePeriod.toLowerCase() === 'am' && parseInt(closeHour) === 12) {
      closeTimeInMinutes = parseInt(closeMin || '0'); // 12 AM = 00:xx
    }

    // Handle overnight hours (e.g., 5 PM - 4 AM)
    if (closeTimeInMinutes < openTimeInMinutes) {
      // Overnight: open if current time is after opening OR before closing
      return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes <= closeTimeInMinutes;
    }
    
    // Same day: open if current time is between opening and closing
    return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
  }

  // Check if we might be in an overnight period from yesterday FIRST
  // For example, if it's Sunday 12 AM and Saturday was "11 am–3 am"
  const yesterdayDayIndex = currentDay === 0 ? 5 : (currentDay === 1 ? 6 : currentDay - 2);
  const yesterdayName = dayNames[yesterdayDayIndex];
  
  const yesterdayHours = openingHours.find(hours => 
    hours.toLowerCase().includes(yesterdayName)
  );

  if (yesterdayHours && !yesterdayHours.toLowerCase().includes('closed')) {
    // Extract time range from yesterday
    const timeMatch = yesterdayHours.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    
    if (timeMatch) {
      const [, , , , closeHour, closeMin, closePeriod] = timeMatch;
      
      let closeTimeInMinutes = parseInt(closeHour) * 60 + parseInt(closeMin || '0');
      
      if (closePeriod.toLowerCase() === 'pm' && parseInt(closeHour) !== 12) {
        closeTimeInMinutes += 12 * 60;
      }
      if (closePeriod.toLowerCase() === 'am' && parseInt(closeHour) === 12) {
        closeTimeInMinutes = parseInt(closeMin || '0');
      }

      // If yesterday's closing time is in early AM (indicating overnight), check if we're still in that period
      if (closePeriod.toLowerCase() === 'am' && closeTimeInMinutes <= 12 * 60) { // Closing before noon = overnight
        if (currentTimeInMinutes <= closeTimeInMinutes) {
          return true; // Still in yesterday's overnight period
        }
      }
    }
  }

  // Only check today's hours if we're NOT in yesterday's overnight period
  const googleDayIndex = currentDay === 0 ? 6 : currentDay - 1; // Convert JS day (0=Sunday) to Google format (0=Monday)
  const todayName = dayNames[googleDayIndex];
  
  const todayHours = openingHours.find(hours => 
    hours.toLowerCase().includes(todayName)
  );

  if (todayHours && checkTimeRange(todayHours)) {
    return true;
  }

  return false;
}

// Helper function to check if restaurant's opening time has already passed today
function _hasOpeningTimePassed(openingHours?: string[], currentTime?: Date): boolean {
  if (!openingHours || openingHours.length === 0) return false;
  
  const now = currentTime || new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
  
  // Get today's hours
  const todayHours = openingHours[currentDay === 0 ? 6 : currentDay - 1]; // Adjust for Google's format
  
  if (!todayHours || todayHours.includes('Closed')) return true;
  
  // Extract opening time from formats like "Monday: 9:30 AM – 5:30 PM"
  const timeMatch = todayHours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (timeMatch) {
    let openingHour = parseInt(timeMatch[1]);
    const openingMinute = parseInt(timeMatch[2]);
    const isPM = timeMatch[3] === 'PM';
    
    // Convert to 24-hour format
    if (isPM && openingHour !== 12) openingHour += 12;
    if (!isPM && openingHour === 12) openingHour = 0;
    
    const openingTimeInMinutes = openingHour * 60 + openingMinute;
    
    // Return true if current time has passed opening time
    return currentTimeMinutes > openingTimeInMinutes;
  }
  
  return false;
}

// Helper function to get real-time status information including overnight period details
function getRealTimeStatus(openingHours?: string[], googleOpenNow?: boolean, currentTime?: Date): {
  isOpen: boolean;
  currentPeriod?: {
    day: string;
    hours: string;
    isOvernightPeriod: boolean;
    closesAt?: string;
  };
  message?: string;
} {
  if (!openingHours || openingHours.length === 0) {
    return {
      isOpen: false,
      message: 'Hours not available'
    };
  }

  const now = currentTime || new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayDisplayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Check if we might be in an overnight period from yesterday FIRST
  const yesterdayDayIndex = currentDay === 0 ? 5 : (currentDay === 1 ? 6 : currentDay - 2);
  const yesterdayName = dayNames[yesterdayDayIndex];
  const yesterdayDisplayName = dayDisplayNames[yesterdayDayIndex];
  
  const yesterdayHours = openingHours.find(hours => 
    hours.toLowerCase().includes(yesterdayName)
  );

  if (yesterdayHours && !yesterdayHours.toLowerCase().includes('closed')) {
    // Extract time range from yesterday
    const timeMatch = yesterdayHours.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    
    if (timeMatch) {
      const [, _openHour, _openMin, _openPeriod, closeHour, closeMin, closePeriod] = timeMatch;
      
      let closeTimeInMinutes = parseInt(closeHour) * 60 + parseInt(closeMin || '0');
      
      if (closePeriod.toLowerCase() === 'pm' && parseInt(closeHour) !== 12) {
        closeTimeInMinutes += 12 * 60;
      }
      if (closePeriod.toLowerCase() === 'am' && parseInt(closeHour) === 12) {
        closeTimeInMinutes = parseInt(closeMin || '0');
      }

      // If yesterday's closing time is in early AM (indicating overnight), check if we're still in that period
      if (closePeriod.toLowerCase() === 'am' && closeTimeInMinutes <= 12 * 60) { // Closing before noon = overnight
        if (currentTimeInMinutes <= closeTimeInMinutes) {
          const closeTime12hr = `${closeHour}:${(closeMin || '00').padStart(2, '0')} ${closePeriod.toUpperCase()}`;
          
          return {
            isOpen: true,
            currentPeriod: {
              day: yesterdayDisplayName,
              hours: yesterdayHours.split(': ')[1] || yesterdayHours,
              isOvernightPeriod: true,
              closesAt: closeTime12hr
            },
            message: `Open until ${closeTime12hr} (${yesterdayDisplayName}'s overnight hours)`
          };
        }
      }
    }
  }

  // Check today's hours if not in yesterday's overnight period
  const googleDayIndex = currentDay === 0 ? 6 : currentDay - 1; // Convert JS day (0=Sunday) to Google format (0=Monday)
  const todayName = dayNames[googleDayIndex];
  const todayDisplayName = dayDisplayNames[googleDayIndex];
  
  const todayHours = openingHours.find(hours => 
    hours.toLowerCase().includes(todayName)
  );

  if (todayHours) {
    if (todayHours.toLowerCase().includes('closed')) {
      return {
        isOpen: false,
        currentPeriod: {
          day: todayDisplayName,
          hours: 'Closed',
          isOvernightPeriod: false
        },
        message: `Closed today (${todayDisplayName})`
      };
    }

    // Extract time range
    const timeMatch = todayHours.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    
    if (timeMatch) {
      const [, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = timeMatch;
      
      // Convert to minutes since midnight
      let openTimeInMinutes = parseInt(openHour) * 60 + parseInt(openMin || '0');
      let closeTimeInMinutes = parseInt(closeHour) * 60 + parseInt(closeMin || '0');
      
      // Handle AM/PM conversion
      if (openPeriod.toLowerCase() === 'pm' && parseInt(openHour) !== 12) {
        openTimeInMinutes += 12 * 60;
      }
      if (openPeriod.toLowerCase() === 'am' && parseInt(openHour) === 12) {
        openTimeInMinutes = parseInt(openMin || '0');
      }
      
      if (closePeriod.toLowerCase() === 'pm' && parseInt(closeHour) !== 12) {
        closeTimeInMinutes += 12 * 60;
      }
      if (closePeriod.toLowerCase() === 'am' && parseInt(closeHour) === 12) {
        closeTimeInMinutes = parseInt(closeMin || '0');
      }

      const openTime12hr = `${openHour}:${(openMin || '00').padStart(2, '0')} ${openPeriod.toUpperCase()}`;
      const closeTime12hr = `${closeHour}:${(closeMin || '00').padStart(2, '0')} ${closePeriod.toUpperCase()}`;

      // Handle overnight hours (e.g., 5 PM - 4 AM)
      if (closeTimeInMinutes < openTimeInMinutes) {
        const isCurrentlyOpen = currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes <= closeTimeInMinutes;
        
        if (isCurrentlyOpen) {
          if (currentTimeInMinutes >= openTimeInMinutes) {
            // We're in the opening day part of the overnight period
            return {
              isOpen: true,
              currentPeriod: {
                day: todayDisplayName,
                hours: todayHours.split(': ')[1] || todayHours,
                isOvernightPeriod: true,
                closesAt: closeTime12hr
              },
              message: `Open until ${closeTime12hr} tomorrow (overnight hours)`
            };
          } else {
            // We're in the next day part of the overnight period
            return {
              isOpen: true,
              currentPeriod: {
                day: todayDisplayName,
                hours: todayHours.split(': ')[1] || todayHours,
                isOvernightPeriod: true,
                closesAt: closeTime12hr
              },
              message: `Open until ${closeTime12hr} (${todayDisplayName}'s overnight hours)`
            };
          }
        } else {
          return {
            isOpen: false,
            currentPeriod: {
              day: todayDisplayName,
              hours: todayHours.split(': ')[1] || todayHours,
              isOvernightPeriod: true
            },
            message: `Closed - Opens at ${openTime12hr}`
          };
        }
      } else {
        // Same day hours
        const isCurrentlyOpen = currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
        
        return {
          isOpen: isCurrentlyOpen,
          currentPeriod: {
            day: todayDisplayName,
            hours: todayHours.split(': ')[1] || todayHours,
            isOvernightPeriod: false,
            closesAt: isCurrentlyOpen ? closeTime12hr : undefined
          },
          message: isCurrentlyOpen 
            ? `Open until ${closeTime12hr}` 
            : currentTimeInMinutes < openTimeInMinutes 
              ? `Closed - Opens at ${openTime12hr}` 
              : `Closed - Opens ${openTime12hr} tomorrow`
        };
      }
    }
  }

  // Fallback to Google's status if we can't parse hours
  return {
    isOpen: googleOpenNow || false,
    message: googleOpenNow ? 'Currently open' : 'Currently closed'
  };
}

interface Restaurant {
  id: string;
  name: string;
  rating: number;
  address: string;
  phone?: string;
  website?: string;
  googleMapsUrl: string;
  isOpen: boolean;
  openingHours?: string[];
  priceLevel?: number;
  cuisine?: string;
  distance?: number;
  photoUrl?: string;
  geometry?: {
    lat: number;
    lng: number;
  };
  aiRecommendation?: string;
  realTimeStatus?: {
    isOpen: boolean;
    currentPeriod?: {
      day: string;
      hours: string;
      isOvernightPeriod: boolean;
      closesAt?: string;
    };
    message?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { location, preferences = '', userLocation, radius = 10000 } = await request.json();

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    // Check for required API keys
    if (!process.env.CLAUDE_API_KEY) {
      console.error('Claude API key not found');
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 500 }
      );
    }

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.error('Google Places API key not found');
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Step 1: Use Google Places to Find Places to Eat
    // Simplified and more faithful search query construction
    let searchQuery = `restaurants in ${location}`;
    let searchType = 'restaurant'; // Default type
    
    // Parse location to extract coordinates if provided as lat,lng
    let searchLocation = location;
    let userCoords = userLocation;
    
    // Check if location is coordinates (e.g., "-33.8688, 151.2093")
    const coordsMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      
      // Use reverse geocoding to get a readable location name
      try {
        const geocodeResponse = await googleMapsClient.reverseGeocode({
          params: {
            latlng: `${lat},${lng}`,
            key: process.env.GOOGLE_PLACES_API_KEY!,
          },
        });
        
        if (geocodeResponse.data.results && geocodeResponse.data.results[0]) {
          const result = geocodeResponse.data.results[0];
          searchLocation = result.formatted_address;
          
          // Use the coordinates from the location input
          userCoords = { lat, lng };
        }
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
      }
    }
    
    if (preferences && preferences.trim().length > 0) {
      // Clean up preferences but preserve the user's actual words
      const cleanPrefs = preferences
        .replace(/[^\w\s&'-]/g, '') // Keep word characters, spaces, ampersands, apostrophes, and hyphens
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim();
      
      if (cleanPrefs.length > 0) {
        // Use user's exact preferences in the search query
        searchQuery = `${cleanPrefs} restaurants in ${searchLocation}`;
        
        // Only detect if it's clearly a different establishment type
        const lowerPrefs = cleanPrefs.toLowerCase();
        if (lowerPrefs.includes('cafe') || lowerPrefs.includes('coffee shop')) {
          searchType = 'cafe';
          searchQuery = `${cleanPrefs} in ${searchLocation}`;
        } else if (lowerPrefs.includes('bar') || lowerPrefs.includes('pub') || lowerPrefs.includes('drinks')) {
          searchType = 'bar';
          searchQuery = `${cleanPrefs} in ${searchLocation}`;
        }
      }
    }
    
    // Step 1: Search for restaurants using the new Google Places API
    const searchRequest: SearchRequest = {
      textQuery: searchQuery,
      fieldMask: SEARCH_FIELD_MASK,
    };

    // Add location bias if user coordinates are available
    if (userCoords && typeof userCoords === 'object' && 'lat' in userCoords && 'lng' in userCoords) {
      searchRequest.locationBias = {
        circle: {
          center: formatLocationForNewAPI(userCoords.lat, userCoords.lng),
          radius: radius
        }
      };
    }

    // Add place type if it's not the default restaurant type
    if (searchType !== 'restaurant') {
      searchRequest.includedType = searchType;
    }

    const placesResponse = await placesClient.searchText(searchRequest);

    if (!placesResponse?.places || placesResponse.places.length === 0) {
      return NextResponse.json({
        restaurants: [],
        message: 'No places found in the specified location',
      });
    }

    // Step 2: Get detailed information for each restaurant
    const restaurantPromises = placesResponse.places.slice(0, 12).map(async (place: PlaceFromSearch) => {
      try {
        // Get place details using the new Places API
        const details = await placesClient.getPlace({
          name: `places/${place.id}`,
          fieldMask: DETAILS_FIELD_MASK,
        });

        const _isOpenNow = details.currentOpeningHours?.openNow ?? false;
        
        // Get the local time for this restaurant's location
        let restaurantLocalTime = new Date(); // Fallback to current time
        if (details.location) {
          restaurantLocalTime = await getLocationTime(
            details.location.latitude,
            details.location.longitude
          );
        }
        
        // Also check with our custom logic for comparison using restaurant's local time
        const _customOpenCheck = isRestaurantOpen(details.regularOpeningHours?.weekdayDescriptions, restaurantLocalTime);

        // Skip places with no opening hours data or temporarily closed status
        if (!details.regularOpeningHours?.weekdayDescriptions || details.businessStatus === 'CLOSED_TEMPORARILY') {
          return null;
        }

        // Don't filter by Google's open_now here - let our timezone-aware logic decide
        // Google's open_now might use different timezone calculations

        // Skip if no opening hours data or temporarily closed
        if (!details.regularOpeningHours?.weekdayDescriptions || details.businessStatus === 'CLOSED_TEMPORARILY') {
          return null;
        }
        if (details.regularOpeningHours?.weekdayDescriptions) {
          const currentDay = restaurantLocalTime.getDay();
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const googleDayIndex = currentDay === 0 ? 6 : currentDay - 1;
          const todayName = dayNames[googleDayIndex];
          const yesterdayDayIndex = currentDay === 0 ? 5 : (currentDay === 1 ? 6 : currentDay - 2);
          const yesterdayName = dayNames[yesterdayDayIndex];
          
          const todaysHoursEntry = details.regularOpeningHours.weekdayDescriptions.find((h: string) => h.toLowerCase().includes(todayName));
          const yesterdaysHoursEntry = details.regularOpeningHours.weekdayDescriptions.find((h: string) => h.toLowerCase().includes(yesterdayName));
          
          // Parse and show the times we're working with
          if (todaysHoursEntry && !todaysHoursEntry.toLowerCase().includes('closed')) {
            const _timeMatch = todaysHoursEntry.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
          }
          
          if (yesterdaysHoursEntry && !yesterdaysHoursEntry.toLowerCase().includes('closed')) {
            const timeMatch = yesterdaysHoursEntry.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
            if (timeMatch) {
              const [, _openHour, _openMin, _openPeriod, closeHour, closeMin, closePeriod] = timeMatch;
              
              // Check if we're in yesterday's overnight period using restaurant's local time
              let closeTimeInMinutes = parseInt(closeHour) * 60 + parseInt(closeMin || '0');
              if (closePeriod.toLowerCase() === 'pm' && parseInt(closeHour) !== 12) {
                closeTimeInMinutes += 12 * 60;
              }
              if (closePeriod.toLowerCase() === 'am' && parseInt(closeHour) === 12) {
                closeTimeInMinutes = parseInt(closeMin || '0');
              }
              
              const currentTimeInMinutes = restaurantLocalTime.getHours() * 60 + restaurantLocalTime.getMinutes();
              if (closePeriod.toLowerCase() === 'am' && closeTimeInMinutes <= 12 * 60) {
                if (currentTimeInMinutes <= closeTimeInMinutes) {
                  // Still in yesterday's overnight period
                } else {
                  // Yesterday's overnight period ended
                }
              }
            }
          }
        }

        // Get photo URL if available
        let photoUrl = undefined;
        if (details.photos && details.photos.length > 0) {
          // New Places API returns photo names instead of photo references
          const photoName = details.photos[0].name;
          photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        }

        // Generate one-sentence AI recommendation based on recent reviews
        let aiRecommendation = '';
        
        if (details.reviews && details.reviews.length > 0) {
          try {
            const recentReviews = details.reviews.slice(0, 5);
            const reviewTexts = recentReviews.map((r: PlaceReview) => r.text).filter((text: string | undefined): text is string => text !== undefined && text.length > 0);
            if (reviewTexts.length > 0) {
              const reviewPrompt = `Based on these recent Google Maps reviews for ${details.displayName?.text || details.name}, write ONE concise sentence (max 15 words) highlighting what makes this restaurant special:

Recent reviews:
${reviewTexts.slice(0, 3).map((text: string, i: number) => `${i + 1}. "${text.substring(0, 150)}"`).join('\n')}

Respond with just one sentence, no quotes or extra text.`;

              const quickResponse = await anthropic.messages.create({
                model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
                max_tokens: 50,
                messages: [{ role: 'user', content: reviewPrompt }],
              });

              aiRecommendation = quickResponse.content[0].type === 'text' 
                ? quickResponse.content[0].text.trim().replace(/['"]/g, '') 
                : '';
                
            } else {
              // Fallback: Create a generic recommendation based on rating and type
              const rating = details.rating || 0;
              const ratingText = rating >= 4.5 ? 'highly rated' : 
                               rating >= 4.0 ? 'well reviewed' : 
                               rating >= 3.5 ? 'popular' : 'local';
              aiRecommendation = `A ${ratingText} restaurant with ${rating}/5 stars.`;
            }
          } catch (error) {
            console.error(`Error generating AI recommendation for ${details.displayName?.text || details.name}:`, error);
            // Fallback: Create a simple recommendation based on available data
            const rating = details.rating || 0;
            const ratingText = rating >= 4.5 ? 'highly rated' : 
                             rating >= 4.0 ? 'well reviewed' : 
                             rating >= 3.5 ? 'popular' : 'local';
            aiRecommendation = `A ${ratingText} restaurant with ${rating}/5 stars.`;
          }
        } else {
          // Fallback: Create a simple recommendation based on available data
          const rating = details.rating || 0;
          const ratingText = rating >= 4.5 ? 'highly rated' : 
                           rating >= 4.0 ? 'well reviewed' : 
                           rating >= 3.5 ? 'popular' : 'local';
          aiRecommendation = `A ${ratingText} restaurant with ${rating}/5 stars.`;
        }

        // Get real-time status information including overnight period details using restaurant's local time
        const realTimeStatus = getRealTimeStatus(details.regularOpeningHours?.weekdayDescriptions, details.currentOpeningHours?.openNow, restaurantLocalTime);

        // Skip if our timezone-aware logic says it's closed
        if (!realTimeStatus.isOpen) {
          return null;
        }

        const restaurant: Restaurant = {
          id: place.id!,
          name: details.displayName?.text || details.name || 'Unknown Restaurant',
          rating: details.rating || 0,
          address: details.formattedAddress || 'Address not available',
          phone: details.nationalPhoneNumber,
          website: details.websiteUri,
          googleMapsUrl: details.location 
            ? `https://www.google.com/maps/search/?api=1&query=${details.location.latitude},${details.location.longitude}&query_place_id=${place.id}`
            : `https://www.google.com/maps/place/?q=place_id:${place.id}`,
          isOpen: realTimeStatus.isOpen, // Use timezone-aware status from realTimeStatus
          openingHours: details.regularOpeningHours?.weekdayDescriptions,
          priceLevel: details.priceLevel,
          photoUrl,
          geometry: details.location ? {
            lat: details.location.latitude,
            lng: details.location.longitude
          } : undefined,
          distance: userCoords && details.location ? 
            calculateDistance(
              userCoords.lat, 
              userCoords.lng, 
              details.location.latitude, 
              details.location.longitude
            ) : undefined,
          aiRecommendation: aiRecommendation,
          realTimeStatus: realTimeStatus
        };

        return restaurant;
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
        return null;
      }
    });

    const restaurants = (await Promise.all(restaurantPromises)).filter(Boolean) as Restaurant[];

    // Filter to only show currently open restaurants and apply distance filtering
    const availableRestaurants = restaurants.filter(restaurant => {
      // Skip if restaurant data is invalid
      if (!restaurant) {
        return false;
      }
      
      // Only show currently open restaurants
      if (!restaurant.isOpen) {
        return false;
      }
      
      // Check distance if user coordinates are available
      if (userCoords && restaurant.distance !== undefined) {
        const radiusInKm = radius / 1000; // Convert radius from meters to km
        return restaurant.distance <= radiusInKm;
      }
      
      // If no distance info, include the restaurant
      return true;
    });

    // Step 3: Use Claude AI to analyze and rank the restaurants
    const claudePrompt = `
You are an expert restaurant recommendation AI with deep knowledge of dining preferences, dietary restrictions, and food culture. I found ${availableRestaurants.length} restaurants in ${searchLocation}.

USER PREFERENCES:
- Location: ${searchLocation}
- Preferences: "${preferences || 'No specific preferences mentioned'}"

Here are the restaurants with their details:
${availableRestaurants.map((r, i) => `
${i + 1}. ${r.name}
   - Rating: ${r.rating}/5 (${r.rating >= 4.5 ? 'Excellent' : r.rating >= 4.0 ? 'Very Good' : r.rating >= 3.5 ? 'Good' : 'Average'})
   - Address: ${r.address}
   - Currently: ${r.isOpen ? 'OPEN' : 'CLOSED'}
   ${r.distance ? `- Distance: ${r.distance.toFixed(1)} km away` : ''}
   - Price Level: ${r.priceLevel ? '$'.repeat(r.priceLevel) + ` (${r.priceLevel === 1 ? 'Budget-friendly' : r.priceLevel === 2 ? 'Moderate' : r.priceLevel === 3 ? 'Expensive' : 'Very Expensive'})` : 'Price not specified'}
   ${r.phone ? `- Phone: ${r.phone}` : ''}
   ${r.website ? `- Website: Available` : ''}
   ${r.openingHours ? `- Hours: ${r.openingHours[0] || 'Hours vary'}` : ''}
`).join('')}

ANALYSIS TASK:
Please provide intelligent restaurant recommendations based on the user's exact preferences: "${preferences || 'general dining'}"

IMPORTANT: The user specifically requested "${preferences || 'general dining'}". Please prioritize restaurants that can serve exactly what they asked for, rather than making broad cuisine assumptions.

Consider:
1. **Exact Food Match**: Does this restaurant serve the specific food items the user mentioned? (e.g., if they want "steak and chips", look for restaurants that serve steak and chips/fries)
2. **User's Actual Words**: Use the user's exact preferences, don't generalize them into broad categories
3. **Menu Compatibility**: Consider if the restaurant's type/style typically serves what the user wants
4. **Proximity**: Prioritize closer restaurants when possible (distance shown in km)
5. **Availability**: Prioritize open restaurants
6. **Quality**: Consider ratings and reputation
7. **Suitability**: Match the user's specific timing and occasion needs

For each recommendation, provide:
- **Exact Food Match**: Explain how this restaurant can serve the specific food items they requested
- **Menu Compatibility**: Describe what on their likely menu matches the user's exact preferences
- **Distance & Convenience**: How proximity factors into the recommendation
- **Quality & Atmosphere**: What makes it a good choice for their specific dining needs
- **Why This Restaurant**: What specifically makes it suited to fulfill their request

Return only a JSON object with this structure:
{
  "recommendations": [
    {
      "restaurantIndex": 0,
      "reasoning": "Specific explanation of how this restaurant can fulfill their exact request for '${preferences || 'general dining'}', including what menu items they likely have that match."
    }
  ],
  "summary": "A focused summary explaining how these restaurants can specifically provide what the user asked for: '${preferences || 'general dining'}'."
}

Important: Only return valid JSON, no additional text.
`;

    let rankedRestaurants = availableRestaurants;
    let aiSummary = '';

    try {
      const modelToUse = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
      const maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS || '1000');
      
      const claudeResponse = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: claudePrompt,
          },
        ],
      });

      const responseText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      
      try {
        const aiResponse = JSON.parse(responseText);
        
        if (aiResponse.recommendations && Array.isArray(aiResponse.recommendations)) {
          // Reorder restaurants based on AI recommendations
          const reorderedRestaurants: Restaurant[] = [];
          const usedIndices = new Set<number>();

          // Add restaurants in AI-recommended order with reasoning
          for (const rec of aiResponse.recommendations) {
            const index = rec.restaurantIndex;
            if (index >= 0 && index < availableRestaurants.length && !usedIndices.has(index)) {
              const restaurantWithReasoning = {
                ...availableRestaurants[index],
                claudeReasoning: rec.reasoning
              };
              reorderedRestaurants.push(restaurantWithReasoning);
              usedIndices.add(index);
            }
          }

          // Add any remaining restaurants
          for (let i = 0; i < availableRestaurants.length; i++) {
            if (!usedIndices.has(i)) {
              reorderedRestaurants.push(availableRestaurants[i]);
            }
          }

          rankedRestaurants = reorderedRestaurants;
        }

        aiSummary = aiResponse.summary || '';
      } catch (parseError) {
        console.error('Error parsing Claude response:', parseError);
        // Fall back to smart sorting: open restaurants first, then by distance, then by rating
        rankedRestaurants = availableRestaurants.sort((a, b) => {
          // Open restaurants first
          if (a.isOpen !== b.isOpen) {
            return a.isOpen ? -1 : 1;
          }
          // Then by distance if available
          if (a.distance !== undefined && b.distance !== undefined) {
            if (Math.abs(a.distance - b.distance) > 0.5) { // Only prioritize if difference > 0.5km
              return a.distance - b.distance;
            }
          }
          // Finally by rating
          return b.rating - a.rating;
        });
      }
    } catch (claudeError) {
      console.error('Claude API error:', claudeError);
      // Fall back to smart sorting: open restaurants first, then by distance, then by rating
      rankedRestaurants = availableRestaurants.sort((a, b) => {
        // Open restaurants first
        if (a.isOpen !== b.isOpen) {
          return a.isOpen ? -1 : 1;
        }
        // Then by distance if available
        if (a.distance !== undefined && b.distance !== undefined) {
          if (Math.abs(a.distance - b.distance) > 0.5) { // Only prioritize if difference > 0.5km
            return a.distance - b.distance;
          }
        }
        // Finally by rating
        return b.rating - a.rating;
      });
    }

    // Save search history and update keywords in the background
    // Convert "Current Location" to coordinates for database storage
    let locationForDatabase = searchLocation;
    if (location === 'Current Location' && userCoords) {
      locationForDatabase = `${userCoords.lat}, ${userCoords.lng}`;
    }
    
    Promise.all([
      saveSearchHistory(locationForDatabase, preferences, searchQuery, rankedRestaurants.length, userCoords, request),
      updateKeywords(preferences)
    ]).catch(() => {
      // Silent fail for background analytics
    });

    return NextResponse.json({
      restaurants: rankedRestaurants,
      summary: aiSummary,
      location,
      preferences,
    });

  } catch (error) {
    console.error('Restaurant search error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search restaurants',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
