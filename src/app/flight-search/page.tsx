'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import DateRangePicker from '@/components/DateRangePicker';

// Types for search results
interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  info?: string;
}

interface CityGroup {
  city: string;
  country: string;
  airports: Airport[];
  isMultiAirport: boolean;
}

interface SearchResult {
  type: 'airport' | 'city';
  airport?: Airport;
  cityGroup?: CityGroup;
  displayName: string;
}

interface SelectedLocation {
  type: 'airport' | 'city';
  airport?: Airport;
  cityGroup?: CityGroup;
  displayName: string;
}

// Airport Autocomplete Component
interface AirportAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string, selection?: SelectedLocation) => void;
  placeholder: string;
  required?: boolean;
}

function AirportAutocomplete({ label, value, onChange, placeholder, required }: AirportAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_selectedType, setSelectedType] = useState<'airport' | 'city' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchAirports = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/airports?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.results || []);
        setShowSuggestions((data.results || []).length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching airports:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (newValue.length >= 2) {
      setShowSuggestions(true);
      searchAirports(newValue);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectOption = (result: SearchResult) => {
    const displayValue = result.displayName;
    const selection: SelectedLocation = {
      type: result.type,
      airport: result.airport,
      cityGroup: result.cityGroup,
      displayName: result.displayName
    };
    
    setSelectedType(result.type);
    onChange(displayValue, selection);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="position-relative">
      {label && (
        <label className="form-label">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="form-control"
        autoComplete="off"
        suppressHydrationWarning
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="dropdown-menu show position-absolute w-100 mt-1 shadow-lg border-0" style={{ maxHeight: '300px', overflowY: 'auto', zIndex: 1050 }}>
          {suggestions.map((result, index) => (
            <div
              key={`${result.type}-${index}-${result.airport?.iata || result.cityGroup?.city}`}
              onClick={() => selectOption(result)}
              className="dropdown-item d-flex align-items-center py-2 border-bottom"
              style={{ cursor: 'pointer' }}
            >
              <div className="me-3">
                <span className={`badge rounded-pill ${result.type === 'city' ? 'bg-primary' : 'bg-secondary'}`}>
                  {result.type === 'city' ? '🏙️' : '✈️'}
                </span>
              </div>
              <div className="flex-grow-1 me-3">
                {result.type === 'city' ? (
                  <>
                    <div className="fw-semibold airport-dropdown-text">
                      {result.cityGroup?.city}, {result.cityGroup?.country} (All Airports)
                    </div>
                    <small className="airport-dropdown-subtext">
                      {result.cityGroup?.airports.length} airports available • searches all airports in city
                    </small>
                  </>
                ) : (
                  <>
                    <div className="fw-semibold airport-dropdown-text">
                      {result.airport?.name}
                    </div>
                    <small className="airport-dropdown-subtext">
                      {result.airport?.city}, {result.airport?.country} • specific airport
                    </small>
                  </>
                )}
              </div>
              <div className="ms-auto">
                <span className="badge airport-dropdown-badge font-monospace">
                  {result.type === 'city' ? 'ALL' : result.airport?.iata}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {loading && (
        <div className="position-absolute end-0 top-50 translate-middle-y me-3">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Flight Search Page
export default function FlightSearch() {
  const [selectedLocations, setSelectedLocations] = useState<{
    departure?: SelectedLocation;
    arrival?: SelectedLocation;
  }>({});
  const [formData, setFormData] = useState({
    tripType: 'roundtrip' as 'roundtrip' | 'oneway',
    departureLocation: '',
    arrivalLocation: '',
    departureDate: '',
    returnDate: '',
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: 'economy' as 'economy' | 'premium' | 'business' | 'first',
  });

  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [infantAges, setInfantAges] = useState<number[]>([]);
  const [infantInLap, setInfantInLap] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseInt(value) || 0 : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    if (name === 'children') {
      const childCount = parseInt(value) || 0;
      setChildrenAges(prev => {
        const newAges = [...prev];
        if (childCount > prev.length) {
          for (let i = prev.length; i < childCount; i++) {
            newAges.push(10);
          }
        } else if (childCount < prev.length) {
          newAges.splice(childCount);
        }
        return newAges;
      });
    }

    if (name === 'infants') {
      const infantCount = parseInt(value) || 0;
      setInfantAges(prev => {
        const newAges = [...prev];
        if (infantCount > prev.length) {
          for (let i = prev.length; i < infantCount; i++) {
            newAges.push(0);
          }
        } else if (infantCount < prev.length) {
          newAges.splice(infantCount);
        }
        return newAges;
      });
      
      if (infantCount === 0) {
        setInfantInLap(false);
      }
    }
  };

  const handleChildAgeChange = (index: number, age: number) => {
    setChildrenAges(prev => {
      const newAges = [...prev];
      newAges[index] = age;
      return newAges;
    });
  };

  const handleInfantAgeChange = (index: number, age: number) => {
    setInfantAges(prev => {
      const newAges = [...prev];
      newAges[index] = age;
      return newAges;
    });
  };

  const handleLocationChange = (field: 'departureLocation' | 'arrivalLocation', value: string, selection?: SelectedLocation) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (selection) {
      setSelectedLocations(prev => ({
        ...prev,
        [field === 'departureLocation' ? 'departure' : 'arrival']: selection
      }));
    }
  };

  const getDepartureInfo = (location?: SelectedLocation) => {
    if (!location) {
      return {
        airport: formData.departureLocation,
        city: '',
        code: ''
      };
    }

    if (location.type === 'city' && location.cityGroup) {
      return {
        airport: `${location.cityGroup.city} (All Airports)`,
        city: `${location.cityGroup.city}, ${location.cityGroup.country}`,
        code: 'ALL'
      };
    } else if (location.type === 'airport' && location.airport) {
      return {
        airport: location.airport.name,
        city: `${location.airport.city}, ${location.airport.country}`,
        code: location.airport.iata
      };
    }

    return {
      airport: location.displayName,
      city: '',
      code: ''
    };
  };

  const generateUrl = async () => {
    if (!formData.departureLocation || !formData.arrivalLocation || !formData.departureDate) {
      alert('Please fill in departure location, arrival location, and departure date.');
      return;
    }

    if (formData.tripType === 'roundtrip' && !formData.returnDate) {
      alert('Please enter a return date for roundtrip flights.');
      return;
    }

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const departureDate = new Date(formData.departureDate);
    departureDate.setHours(0, 0, 0, 0);

    if (departureDate < today) {
      alert('Departure date cannot be in the past.');
      return;
    }

    if (formData.tripType === 'roundtrip' && formData.returnDate) {
      const returnDate = new Date(formData.returnDate);
      returnDate.setHours(0, 0, 0, 0);
      
      if (returnDate <= departureDate) {
        alert('Return date must be after the departure date.');
        return;
      }
    }

    const totalPassengers = formData.adults + formData.children + formData.infants;
    if (totalPassengers > 6) {
      alert('Total passengers cannot exceed 6. Please reduce the number of passengers.');
      return;
    }

    if (formData.adults < (formData.children + formData.infants)) {
      alert('Number of adults must be greater than or equal to the total number of children and infants.');
      return;
    }

    const departureLocation = selectedLocations.departure;
    const arrivalLocation = selectedLocations.arrival;

    if (!departureLocation || !arrivalLocation) {
      alert('Please select departure and arrival locations from the dropdown suggestions.');
      return;
    }

    const departureInfo = getDepartureInfo(departureLocation);
    const arrivalInfo = getDepartureInfo(arrivalLocation);
    
    const params = {
      tripType: formData.tripType,
      departureAirport: departureInfo.airport,
      departureCity: departureInfo.city,
      departureCode: departureInfo.code,
      arrivalAirport: arrivalInfo.airport,
      arrivalCity: arrivalInfo.city,
      arrivalCode: arrivalInfo.code,
      departureDate: formData.departureDate,
      returnDate: formData.returnDate,
      adults: formData.adults,
      children: formData.children,
      childrenAges: childrenAges,
      infants: formData.infants,
      infantAges: infantAges,
      infantInLap: infantInLap,
      cabinClass: formData.cabinClass
    };

    try {
      // Call the API to generate the URL with affiliate config on the server-side
      const response = await fetch('/api/flights/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to generate flight URL');
      }

      const data = await response.json();
      
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('No URL returned from API');
      }
    } catch (error) {
      console.error('Error generating flight URL:', error);
      alert('Sorry, there was an error generating the flight search. Please try again.');
    }
  };

  return (
    <div className="min-vh-100 bg-light-cream">
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg navbar-theme">
        <div className="container">
          <Link className="navbar-brand fw-bold d-block w-100 text-center text-lg-start mb-2 mb-lg-0" href="/">
            <i className="bi bi-compass me-2"></i>
            Where to Eat, Fly, Stay, & Do
          </Link>
          <div className="navbar-nav d-flex flex-row justify-content-center justify-content-lg-end w-100 gap-3 gap-lg-0 ms-lg-auto">
            <Link className="nav-link text-center" href="/">Restaurants</Link>
            <Link className="nav-link text-primary fw-semibold text-center" href="/flight-search">Flight Search</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-light-cream py-5 mb-0">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-12 text-center text-lg-start">
              <div>
                <div className="d-inline-block bg-harvest-gold bg-opacity-20 rounded-4 px-3 py-2 mb-3">
                  <span className="text-jet-black fw-semibold">
                    <i className="bi bi-airplane me-2"></i>
                    AI-Powered Flight Search
                  </span>
                </div>
                <div>
                  <h1 className="display-4 fw-bold text-jet-black mb-3">
                    Where to Fly
                  </h1>
                  <p className="lead mb-0 fw-semibold text-charcoal-gray">
                    <i className="bi bi-robot me-2"></i>
                    Smart flight affiliate link generator
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container py-5">
        {/* Flight Search Form */}
        <div className="card card-appetizing search-form-container mb-5 fade-in">
          <div className="card-body p-4 p-md-5">
            <div className="mb-4">
              <h2 className="card-title h3 fw-bold mb-0">
                <i className="bi bi-airplane me-2 text-primary"></i>
                Find Flight Deals
              </h2>
            </div>
            
            <form onSubmit={(e) => e.preventDefault()} suppressHydrationWarning>
              {/* Row 1: Trip Type and Cabin Class */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label htmlFor="tripType" className="form-label">
                    <i className="bi bi-arrow-left-right me-2"></i>
                    Trip Type
                  </label>
                  <select
                    id="tripType"
                    name="tripType"
                    value={formData.tripType}
                    onChange={handleInputChange}
                    className="form-select"
                    suppressHydrationWarning
                  >
                    <option value="roundtrip">Round Trip</option>
                    <option value="oneway">One Way</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="cabinClass" className="form-label">
                    <i className="bi bi-star me-2"></i>
                    Cabin Class
                  </label>
                  <select
                    id="cabinClass"
                    name="cabinClass"
                    value={formData.cabinClass}
                    onChange={handleInputChange}
                    className="form-select"
                    suppressHydrationWarning
                  >
                    <option value="economy">Economy</option>
                    <option value="premium">Premium Economy</option>
                    <option value="business">Business</option>
                    <option value="first">First Class</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Passengers */}
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label htmlFor="adults" className="form-label">
                    <i className="bi bi-person-fill me-2"></i>
                    Adults
                  </label>
                  <input
                    type="number"
                    id="adults"
                    name="adults"
                    value={formData.adults}
                    onChange={handleInputChange}
                    min="1"
                    className="form-control"
                    suppressHydrationWarning
                  />
                </div>
                <div className="col-md-4">
                  <label htmlFor="children" className="form-label">
                    <i className="bi bi-person me-2"></i>
                    Children
                  </label>
                  <input
                    type="number"
                    id="children"
                    name="children"
                    value={formData.children}
                    onChange={handleInputChange}
                    min="0"
                    className="form-control"
                    suppressHydrationWarning
                  />
                </div>
                <div className="col-md-4">
                  <label htmlFor="infants" className="form-label">
                    <i className="bi bi-heart-fill me-2"></i>
                    Infants
                  </label>
                  <input
                    type="number"
                    id="infants"
                    name="infants"
                    value={formData.infants}
                    onChange={handleInputChange}
                    min="0"
                    className="form-control"
                    suppressHydrationWarning
                  />
                </div>
              </div>

              {/* Dynamic Age Fields for Children */}
              {formData.children > 0 && (
                <div className="row g-3 mb-4">
                  <div className="col-12">
                    <label className="form-label">
                      <i className="bi bi-calendar-check me-2"></i>
                      Children Ages (2-17 years)
                    </label>
                    <div className="row g-2">
                      {Array.from({ length: formData.children }, (_, index) => (
                        <div key={`child-${index}`} className="col-6 col-md-3 col-lg-2">
                          <select
                            value={childrenAges[index] || 10}
                            onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value))}
                            className="form-select form-select-sm"
                            suppressHydrationWarning
                          >
                            {Array.from({ length: 16 }, (_, age) => age + 2).map(age => (
                              <option key={age} value={age}>
                                {age} {age === 1 ? 'year' : 'years'}
                              </option>
                            ))}
                          </select>
                          <small className="text-muted">Child {index + 1}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Age Fields for Infants */}
              {formData.infants > 0 && (
                <div className="row g-3 mb-4">
                  <div className="col-12">
                    <label className="form-label">
                      <i className="bi bi-heart-fill me-2"></i>
                      Infant Ages (0-1 years)
                    </label>
                    <div className="row g-2">
                      {Array.from({ length: formData.infants }, (_, index) => (
                        <div key={`infant-${index}`} className="col-6 col-md-3 col-lg-2">
                          <select
                            value={infantAges[index] || 0}
                            onChange={(e) => handleInfantAgeChange(index, parseInt(e.target.value))}
                            className="form-select form-select-sm"
                            suppressHydrationWarning
                          >
                            <option value={0}>0 years</option>
                            <option value={1}>1 year</option>
                          </select>
                          <small className="text-muted">Infant {index + 1}</small>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="infantInLap"
                          checked={infantInLap}
                          onChange={(e) => setInfantInLap(e.target.checked)}
                          suppressHydrationWarning
                        />
                        <label className="form-check-label" htmlFor="infantInLap">
                          <i className="bi bi-person-arms-up me-1"></i>
                          Infant(s) in lap
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3: Departure and Arrival Locations */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <AirportAutocomplete
                    label="Departure Location"
                    value={formData.departureLocation}
                    onChange={(value, selection) => handleLocationChange('departureLocation', value, selection)}
                    placeholder="Search by city or airport (e.g., London, SYD)"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <AirportAutocomplete
                    label="Arrival Location"
                    value={formData.arrivalLocation}
                    onChange={(value, selection) => handleLocationChange('arrivalLocation', value, selection)}
                    placeholder="Search by city or airport (e.g., Paris, BKK)"
                    required
                  />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <DateRangePicker
                    startDate={formData.departureDate}
                    endDate={formData.returnDate}
                    tripType={formData.tripType}
                    onStartDateChange={(date) => setFormData(prev => ({ ...prev, departureDate: date }))}
                    onEndDateChange={(date) => setFormData(prev => ({ ...prev, returnDate: date }))}
                  />
                </div>
              </div>

              {/* Selection Type Info */}
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <div className="alert alert-info py-2 mb-0" role="alert">
                    <i className="bi bi-info-circle me-2"></i>
                    <small>
                      <strong>💡 Tip:</strong> For cities with multiple airports, you can select the city to search all airports. For single-airport cities, select the <strong>✈️ Specific Airport</strong> directly.
                    </small>
                  </div>
                </div>
              </div>

              {/* Search Button */}
              <div className="row">
                <div className="col-12">
                  <button
                    type="button"
                    onClick={generateUrl}
                    className="btn btn-primary btn-lg w-100"
                  >
                    <i className="bi bi-search me-2"></i>
                    Search Flights
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <p className="text-muted mb-2">
                <small>
                  <i className="bi bi-shield-check me-1"></i>
                  Powered by Expedia Affiliate Network
                </small>
              </p>
              <p className="text-muted small mb-0">
                Affiliate links help support this platform while providing you with the best flight deals available.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
