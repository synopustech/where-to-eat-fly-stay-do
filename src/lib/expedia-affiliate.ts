// Expedia Affiliate URL Generator
// Generates affiliate URLs for flight searches using Expedia's partner program

export interface FlightSearchParams {
  tripType: 'roundtrip' | 'oneway';
  departureAirport: string;
  departureCity: string;
  departureCode: string;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalCode: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  childrenAges: number[];
  infants: number;
  infantAges: number[];
  infantInLap: boolean;
  cabinClass: 'economy' | 'premium' | 'business' | 'first';
}

export interface AffiliateConfig {
  affcid: string;
  my_ad: string;
}

/**
 * Gets affiliate configuration from environment variables
 */
export function getAffiliateConfig(): AffiliateConfig {
  if (!process.env.EXPEDIA_AFFCID || !process.env.EXPEDIA_MY_AD) {
    throw new Error('Expedia affiliate configuration is required. Please set EXPEDIA_AFFCID and EXPEDIA_MY_AD environment variables.');
  }
  
  return {
    affcid: process.env.EXPEDIA_AFFCID,
    my_ad: process.env.EXPEDIA_MY_AD
  };
}

/**
 * Formats date from YYYY-MM-DD to MM/DD/YYYY for Expedia
 */
function formatDateForExpedia(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats date from YYYY-MM-DD to YYYY-M-D format for Expedia
 */
function formatDateISO(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${year}-${month}-${day}`;
}

/**
 * Generates detailed location string for Expedia URLs
 */
function generateDetailedLocation(airport: string, city: string, code: string): string {
  // For specific airports, create detailed format
  if (code && code !== 'ALL' && code.length === 3) {
    // Extract city name from the city field
    const cityName = city.split(',')[0].trim();
    const countryName = city.split(',').slice(1).join(',').trim();
    
    // Format: "City, Country (CODE-Airport Name)"
    return `${cityName}, ${countryName} (${code}-${airport})`;
  }
  
  // For cities with multiple airports
  if (code === 'ALL' || airport.includes('All Airports')) {
    return city; // Use the full city, country format
  }
  
  // Fallback format
  return `${airport} (${code || 'XXX'})`;
}

/**
 * Maps cabin class to Expedia cabin type
 */
function mapCabinClass(cabinClass: string): string {
  const cabinMap: { [key: string]: string } = {
    'economy': 'Coach',
    'premium': 'PremiumEconomy',
    'business': 'Business',
    'first': 'First'
  };
  
  return cabinMap[cabinClass] || 'Coach';
}

/**
 * Generates airport/city codes for Expedia URL
 */
function _generateLocationCode(airport: string, city: string, code: string): string {
  // If it's a specific airport, use the IATA code
  if (code && code !== 'ALL' && code.length === 3) {
    return code;
  }
  
  // For cities with multiple airports, try to extract city name for metro search
  if (code === 'ALL' || airport.includes('All Airports')) {
    // Extract city name for metro area search
    const cityName = city.split(',')[0].trim();
    return cityName.replace(/\s+/g, '').toUpperCase();
  }
  
  // Fallback to the provided code or airport name
  return code || airport.replace(/\s+/g, '').toUpperCase().substring(0, 3);
}

/**
 * Generates complete Expedia affiliate flight search URL
 */
export function generateExpediaFlightUrl(params: FlightSearchParams): string {
  const baseUrl = 'https://www.expedia.com.au/Flights-Search';
  
  // Format dates for different formats needed
  const departureDateFormatted = formatDateForExpedia(params.departureDate);
  const returnDateFormatted = params.returnDate ? formatDateForExpedia(params.returnDate) : '';
  
  // Format dates in ISO format (YYYY-M-D)
  const departureDateISO = formatDateISO(params.departureDate);
  const returnDateISO = params.returnDate ? formatDateISO(params.returnDate) : '';
  
  // Generate detailed location strings with full descriptions
  const originLocation = generateDetailedLocation(params.departureAirport, params.departureCity, params.departureCode);
  const destinationLocation = generateDetailedLocation(params.arrivalAirport, params.arrivalCity, params.arrivalCode);
  
  // Map cabin class
  const cabinType = mapCabinClass(params.cabinClass);
  
  // Build passenger string - combine children and infants with ages in brackets
  let passengerString = '';
  
  // Combine children and infants into one children array with ages
  const allChildrenAges: number[] = [];
  
  // Add children ages
  if (params.children > 0 && params.childrenAges.length > 0) {
    allChildrenAges.push(...params.childrenAges);
  }
  
  // Add infant ages (infants are counted as children)
  if (params.infants > 0 && params.infantAges.length > 0) {
    allChildrenAges.push(...params.infantAges);
  }
  
  // Build children part with ages in brackets
  if (allChildrenAges.length > 0) {
    const agesString = allChildrenAges.join(';');
    passengerString += `children:${allChildrenAges.length}[${agesString}],`;
  }
  
  // Add adults
  passengerString += `adults:${params.adults}`;
  
  // Add infant in lap status (applies to all infants)
  const infantInLapStr = params.infantInLap ? 'Y' : 'N';
  passengerString += `,infantinlap:${infantInLapStr}`;
  
  // Get affiliate configuration from environment variables
  const affiliateConfig = getAffiliateConfig();
  
  // Build leg1 parameter
  const leg1 = `from:${encodeURIComponent(originLocation)},to:${encodeURIComponent(destinationLocation)},departure:${departureDateFormatted}TANYT,fromType:AIRPORT,toType:AIRPORT`;
  
  // Build leg2 parameter for roundtrip
  let leg2 = '';
  if (params.tripType === 'roundtrip' && returnDateFormatted) {
    leg2 = `from:${encodeURIComponent(destinationLocation)},to:${encodeURIComponent(originLocation)},departure:${returnDateFormatted}TANYT,fromType:AIRPORT,toType:AIRPORT`;
  }
  
  // URL parameters - only essential affiliate tracking
  const urlParams = new URLSearchParams({
    'flight-type': 'on',
    'mode': 'search',
    'trip': params.tripType,
    'leg1': leg1,
    'options': `cabinclass:${cabinType}`,
    'fromDate': departureDateFormatted,
    'passengers': passengerString,
    'affcid': affiliateConfig.affcid,
    'my_ad': affiliateConfig.my_ad
  });
  
  // Add leg2 for roundtrip
  if (leg2) {
    urlParams.set('leg2', leg2);
    urlParams.set('toDate', returnDateFormatted);
    urlParams.set('d2', returnDateISO);
  }
  
  // Add ISO date format
  urlParams.set('d1', departureDateISO);
  
  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Validates flight search parameters
 */
export function validateFlightParams(params: Partial<FlightSearchParams>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!params.departureAirport) {
    errors.push('Departure airport is required');
  }
  
  if (!params.arrivalAirport) {
    errors.push('Arrival airport is required');
  }
  
  if (!params.departureDate) {
    errors.push('Departure date is required');
  }
  
  if (params.tripType === 'roundtrip' && !params.returnDate) {
    errors.push('Return date is required for roundtrip flights');
  }
  
  if (!params.adults || params.adults < 1) {
    errors.push('At least 1 adult is required');
  }
  
  const totalPassengers = (params.adults || 0) + (params.children || 0) + (params.infants || 0);
  if (totalPassengers > 6) {
    errors.push('Total passengers cannot exceed 6');
  }
  
  if ((params.adults || 0) < ((params.children || 0) + (params.infants || 0))) {
    errors.push('Number of adults must be greater than or equal to children and infants combined');
  }
  
  if (params.children && params.childrenAges && params.children !== params.childrenAges.length) {
    errors.push('Children ages must match number of children');
  }
  
  if (params.infants && params.infantAges && params.infants !== params.infantAges.length) {
    errors.push('Infant ages must match number of infants');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
