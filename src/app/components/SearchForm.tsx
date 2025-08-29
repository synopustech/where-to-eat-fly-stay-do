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
  const [_googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  
  const locationInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let isComponentMounted = true;

    const initializeAutocomplete = () => {
      if (!isComponentMounted || !locationInputRef.current) {
        console.log('Component not mounted or input ref not available');
        return;
      }

      // Check if Google Maps is available
      if (!window.google?.maps?.places?.Autocomplete) {
        console.log('Google Maps Places API not available');
        setLoadingError(true);
        return;
      }

      try {
        console.log('Initializing Google Places Autocomplete...');

        // Clean up existing autocomplete
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }

        // Create new autocomplete instance
        autocompleteRef.current = new google.maps.places.Autocomplete(
          locationInputRef.current,
          {
            types: ['establishment', 'geocode'],
            fields: ['place_id', 'formatted_address', 'geometry', 'name', 'types']
          }
        );

        // Add place changed listener
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place && place.geometry && place.geometry.location) {
            console.log('Place selected:', place);
            const coords = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };
            setSelectedLocationCoords(coords);
            setLocation(place.formatted_address || place.name || '');
          }
        });

        setAutocompleteReady(true);
        setLoadingError(false);
        console.log('Google Places Autocomplete initialized successfully');
      } catch (error) {
        console.error('Error initializing autocomplete:', error);
        setLoadingError(true);
        setAutocompleteReady(false);
      }
    };

    // Listen for the Google Maps loaded event from layout.tsx
    const handleGoogleMapsLoaded = () => {
      console.log('Google Maps loaded event received');
      setGoogleMapsLoaded(true);
      // Add a small delay to ensure the API is fully ready
      setTimeout(initializeAutocomplete, 100);
    };

    // Check if Google Maps is already loaded
    if (window.google?.maps?.places?.Autocomplete) {
      console.log('Google Maps already loaded');
      setGoogleMapsLoaded(true);
      initializeAutocomplete();
    } else {
      // Listen for the load event
      window.addEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
      
      // Fallback: Poll for Google Maps availability
      let pollCount = 0;
      const maxPolls = 50; // 10 seconds max
      const pollInterval = setInterval(() => {
        pollCount++;
        if (window.google?.maps?.places?.Autocomplete) {
          console.log('Google Maps detected via polling');
          clearInterval(pollInterval);
          setGoogleMapsLoaded(true);
          initializeAutocomplete();
        } else if (pollCount >= maxPolls) {
          console.error('Google Maps failed to load after polling');
          clearInterval(pollInterval);
          setLoadingError(true);
        }
      }, 200);

      return () => {
        window.removeEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
        clearInterval(pollInterval);
      };
    }

    return () => {
      isComponentMounted = false;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isClient]);

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
    // Clear selected coordinates when user types manually
    if (selectedLocationCoords) {
      setSelectedLocationCoords(null);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!onGetUserLocation) {
      console.log('No location handler provided');
      return;
    }

    setLocationLoading(true);
    try {
      const coords = await onGetUserLocation();
      console.log('Got user location:', coords);
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
    <form onSubmit={handleSubmit} className="mb-4">
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
