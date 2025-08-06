'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchFormProps {
  onSearch: (location: string, preferences: string, selectedCoords?: {lat: number, lng: number}, radius?: number) => void;
  loading: boolean;
  onSortChange?: (sortBy: 'relevance' | 'distance' | 'rating') => void;
  currentSort?: string;
  onGetUserLocation?: () => Promise<{lat: number, lng: number}>;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, loading, onSortChange, currentSort, onGetUserLocation }) => {
  const [isClient, setIsClient] = useState(false);
  const [location, setLocation] = useState('');
  const [preferences, setPreferences] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedLocationCoords, setSelectedLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [_autocompleteReady, setAutocompleteReady] = useState(false);
  const [_googleMapsLoaded, _setGoogleMapsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  
  const locationInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [_locationSuggestions, _setLocationSuggestions] = useState<unknown[]>([]);
  const [_showSuggestions, setShowSuggestions] = useState(false);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const initializeAutocomplete = () => {
      if (!locationInputRef.current || autocompleteRef.current) return;

      try {
        // Check if Google Maps and Places are fully loaded
        if (!window.google || !window.google.maps || !window.google.maps.places || !window.google.maps.places.Autocomplete) {
          setTimeout(initializeAutocomplete, 500);
          return;
        }

        // Get user's current location for biasing results
        const getLocationBias = (): google.maps.places.AutocompleteOptions => {
          const defaultOptions: google.maps.places.AutocompleteOptions = {
            types: ['(cities)'],
            fields: ['place_id', 'geometry', 'name', 'formatted_address']
          };

          // Try to get user's location to bias results
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const _userLocation = new window.google.maps.LatLng(
                  position.coords.latitude, 
                  position.coords.longitude
                );
                
                // Update autocomplete with location bias
                if (autocompleteRef.current) {
                  autocompleteRef.current.setBounds(
                    new window.google.maps.LatLngBounds(
                      new window.google.maps.LatLng(
                        position.coords.latitude - 0.5,
                        position.coords.longitude - 0.5
                      ),
                      new window.google.maps.LatLng(
                        position.coords.latitude + 0.5,
                        position.coords.longitude + 0.5
                      )
                    )
                  );
                }
              },
              () => {
                // Silently fail if location access is denied
              },
              { timeout: 5000, enableHighAccuracy: false }
            );
          }

          return defaultOptions;
        };

        // Initialize Google Places Autocomplete with location bias
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          locationInputRef.current, 
          getLocationBias()
        );

        // Handle place selection
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place && place.geometry) {
            setLocation(place.formatted_address || place.name || '');
            setSelectedLocationCoords({
              lat: place.geometry.location?.lat() || 0,
              lng: place.geometry.location?.lng() || 0
            });
          }
        });

        setAutocompleteReady(true);
        setLoadingError(false);
      } catch (error) {
        console.error('Failed to initialize Google Places Autocomplete:', error);
        setLoadingError(true);
        setAutocompleteReady(true); // Still allow manual input
      }
    };

    // Check if Google Maps is already loaded
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      initializeAutocomplete();
    } else {
      // Wait for Google Maps to load
      const handleGoogleMapsLoaded = () => {
        // Add a small delay to ensure places library is fully loaded
        setTimeout(initializeAutocomplete, 100);
      };

      window.addEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
      
      // Also try to initialize periodically in case the event was missed
      const pollInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(pollInterval);
          initializeAutocomplete();
        }
      }, 1000);
      
      // Cleanup listeners
      return () => {
        window.removeEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
        clearInterval(pollInterval);
      };
    }
  }, [isClient]);

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
    setShowSuggestions(false);
    // Clear selected coordinates when user types manually
    if (selectedLocationCoords) {
      setSelectedLocationCoords(null);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!onGetUserLocation) {
      return;
    }

    setLocationLoading(true);
    try {
      const coords = await onGetUserLocation();
      setSelectedLocationCoords(coords);
      setLocation('Current Location');
    } catch (error) {
      console.error('Error getting user location:', error);
      alert('Unable to get your current location. Please enter a location manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (location.trim()) {
      onSearch(location, preferences, selectedLocationCoords || undefined, searchRadius);
    }
  };

  const radiusOptions = [
    { value: 1, label: '1 km' },
    { value: 5, label: '5 km' },
    { value: 10, label: '10 km' },
    { value: 25, label: '25 km' },
    { value: 50, label: '50 km' }
  ];

  if (!isClient) {
    return null; // Prevent hydration mismatch
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4" suppressHydrationWarning>
      <div className="row g-3">
        {/* Location Input */}
        <div className="col-md-6">
          <label htmlFor="location" className="form-label">
            <i className="bi bi-geo-alt me-2"></i>
            Location
          </label>
          <div className="input-group">
            <input
              ref={locationInputRef}
              type="text"
              id="location"
              className="form-control"
              placeholder="Enter city or address..."
              value={location}
              onChange={handleLocationInputChange}
              required
              suppressHydrationWarning
            />
            {onGetUserLocation && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleGetCurrentLocation}
                disabled={locationLoading}
                title="Use current location"
              >
                {locationLoading ? (
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                ) : (
                  <i className="bi bi-crosshair"></i>
                )}
              </button>
            )}
          </div>
          
          {/* Status indicators */}
          <div className="mt-1">
            {loadingError && (
              <small className="text-warning">
                <i className="bi bi-exclamation-triangle me-1"></i>
                Location suggestions unavailable
              </small>
            )}
          </div>
        </div>

        {/* Search Radius */}
        <div className="col-md-3">
          <label htmlFor="radius" className="form-label">
            <i className="bi bi-circle me-2"></i>
            Search Radius
          </label>
          <select
            id="radius"
            className="form-select"
            value={searchRadius}
            onChange={(e) => setSearchRadius(Number(e.target.value))}
            suppressHydrationWarning
          >
            {radiusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        {onSortChange && (
          <div className="col-md-3">
            <label htmlFor="sortBy" className="form-label">
              <i className="bi bi-sort-down me-2"></i>
              Sort By
            </label>
            <select
              id="sortBy"
              className="form-select"
              value={currentSort || 'relevance'}
              onChange={(e) => onSortChange(e.target.value as 'relevance' | 'distance' | 'rating')}
              suppressHydrationWarning
            >
              <option value="relevance">Relevance</option>
              <option value="distance">Distance</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        )}

        {/* Preferences */}
        <div className="col-12">
          <label htmlFor="preferences" className="form-label">
            <i className="bi bi-heart me-2"></i>
            Food Preferences (Optional)
          </label>
          <input
            type="text"
            id="preferences"
            className="form-control"
            placeholder="e.g., Italian, vegetarian, spicy food, romantic atmosphere..."
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            suppressHydrationWarning
          />
          <div className="form-text">
            Describe the type of cuisine, dietary restrictions, or atmosphere you&apos;re looking for.
          </div>
        </div>

        {/* Open Now Filter Info */}
        <div className="col-12">
          <div className="alert alert-info py-2 mb-0 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100" role="alert">
            <i className="bi bi-clock me-2"></i>
            <small>
              <strong>Showing only restaurants that are currently open</strong> based on their posted hours.
            </small>
          </div>
        </div>

        {/* Search Button */}
        <div className="col-12">
          <button
            type="submit"
            className="btn btn-primary btn-lg w-100"
            disabled={loading || !location.trim()}
          >
            {loading ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                Searching...
              </>
            ) : (
              <>
                <i className="bi bi-search me-2"></i>
                Find Places to Eat
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SearchForm;
