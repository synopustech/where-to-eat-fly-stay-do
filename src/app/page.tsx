'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import RestaurantCard from './components/RestaurantCard';
import SearchForm from './components/SearchForm';

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
}

export default function Home() {
  const [_isClient, setIsClient] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [_locationLoading, setLocationLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'distance' | 'rating'>('relevance');
  const [originalRestaurants, setOriginalRestaurants] = useState<Restaurant[]>([]);
  const [searchTerms, setSearchTerms] = useState<string>('');

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const getUserLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      setLocationLoading(true);
      
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        setLocationLoading(false);
        reject(new Error('Geolocation is not supported by this browser. Please enter your location manually.'));
        return;
      }

      // Enhanced options for mobile devices
      const options = {
        enableHighAccuracy: true, // Use GPS if available
        timeout: 15000, // 15 second timeout
        maximumAge: 300000 // Accept location up to 5 minutes old
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLocationLoading(false);
          resolve(location);
        },
        (error) => {
          setLocationLoading(false);
          let errorMessage = 'Unable to get your location. ';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location access was denied. Please enable location permissions in your browser settings and try again.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable. Please check your device\'s location settings.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out. Please try again or enter your location manually.';
              break;
            default:
              errorMessage += 'An unknown error occurred while retrieving location.';
              break;
          }
          
          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // Function to calculate relevance score based on keyword matching
  const calculateRelevanceScore = (restaurant: Restaurant, searchTerms: string): number => {
    if (!searchTerms || !restaurant.aiRecommendation) return 0;
    
    const searchWords = searchTerms.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const aiText = restaurant.aiRecommendation.toLowerCase();
    const restaurantName = restaurant.name.toLowerCase();
    
    let score = 0;
    
    searchWords.forEach(word => {
      // Higher score for exact matches in AI recommendation
      if (aiText.includes(word)) {
        score += 3;
      }
      
      // Medium score for matches in restaurant name
      if (restaurantName.includes(word)) {
        score += 2;
      }
      
      // Lower score for partial matches
      if (aiText.includes(word.substring(0, Math.max(3, word.length - 1)))) {
        score += 1;
      }
    });
    
    
    return score;
  };  const sortRestaurants = (restaurants: Restaurant[], sortType: 'relevance' | 'distance' | 'rating'): Restaurant[] => {
    const sorted = [...restaurants];
    
    switch (sortType) {
      case 'distance':
        return sorted.sort((a, b) => {
          // First, prioritize restaurants with distance info
          if (a.distance !== undefined && b.distance === undefined) return -1;
          if (a.distance === undefined && b.distance !== undefined) return 1;
          
          // If both have distance info, sort by distance
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          
          // If neither has distance info, sort by rating as fallback
          return b.rating - a.rating;
        });
      
      case 'rating':
        return sorted.sort((a, b) => {
          // First by rating
          if (Math.abs(a.rating - b.rating) > 0.1) {
            return b.rating - a.rating;
          }
          // Then prioritize open restaurants
          if (a.isOpen !== b.isOpen) {
            return a.isOpen ? -1 : 1;
          }
          // Finally by distance if available
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          return 0;
        });
      
      case 'relevance':
      default:
        // Sort by keyword relevance score first, then by AI order
        return sorted.sort((a, b) => {
          const scoreA = calculateRelevanceScore(a, searchTerms);
          const scoreB = calculateRelevanceScore(b, searchTerms);
          
          // If relevance scores are different, sort by that
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          
          // If relevance scores are the same, prioritize open restaurants
          if (a.isOpen !== b.isOpen) {
            return a.isOpen ? -1 : 1;
          }
          
          // Finally, sort by rating as fallback
          return b.rating - a.rating;
        });
    }
  };

  const handleSortChange = (newSort: 'relevance' | 'distance' | 'rating') => {
    setSortBy(newSort);
    if (originalRestaurants.length > 0) {
      const sortedRestaurants = sortRestaurants(originalRestaurants, newSort);
      setRestaurants(sortedRestaurants);
    }
  };

  const handleSearch = async (location: string, preferences: string, selectedCoords?: {lat: number, lng: number}, radius: number = 10) => {
    setLoading(true);
    setError(null);
    setRestaurants([]);
    setAiSummary('');
    setSearchTerms(preferences); // Store search terms for relevance scoring

    try {
      const endpoint = '/api/restaurants/search';
      
      const searchData: {
        location: string;
        preferences: string;
        radius: number;
        userLocation?: { lat: number; lng: number };
      } = { 
        location, 
        preferences,
        radius: radius * 1000 // Convert km to meters for Google API
      };

      // Add user location coordinates - prioritize selectedCoords from autocomplete
      if (selectedCoords) {
        searchData.userLocation = selectedCoords;
      } else if (userLocation) {
        searchData.userLocation = userLocation;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search restaurants');
      }

      if (data.restaurants && data.restaurants.length > 0) {
        setOriginalRestaurants(data.restaurants);
        const sortedRestaurants = sortRestaurants(data.restaurants, sortBy);
        setRestaurants(sortedRestaurants);
        
        if (data.summary) {
          setAiSummary(data.summary);
        }
      } else {
        setRestaurants([]);
        setOriginalRestaurants([]);
        setError('No places found in this location. Try a different search.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setRestaurants([]);
      setOriginalRestaurants([]);
    } finally {
      setLoading(false);
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
            <Link className="nav-link fw-semibold text-primary text-center" href="/">Restaurants</Link>
            <Link className="nav-link text-center" href="/flight-search">Flight Search</Link>
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
                    <i className="bi bi-geo-alt-fill me-2"></i>
                    AI-Powered Restaurant Discovery
                  </span>
                </div>
                <div>
                  <h1 className="display-4 fw-bold text-jet-black mb-3">
                    Where to Eat
                  </h1>
                  <p className="lead mb-0 fw-semibold text-charcoal-gray">
                    <i className="bi bi-robot me-2"></i>
                    AI-powered restaurant recommendations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container py-5">
        {/* Search Form */}
        <div className="card card-appetizing search-form-container mb-5 fade-in">
          <div className="card-body p-4 p-md-5">
            {/* Location Button */}
            <div className="mb-4">
              <h2 className="card-title h3 fw-bold mb-0">
                <i className="bi bi-search me-2 text-primary"></i>
                Find Places to Eat
              </h2>
            </div>
            
            <SearchForm 
              onSearch={handleSearch} 
              loading={loading}
              onGetUserLocation={getUserLocation}
              onSortChange={handleSortChange}
              currentSort={sortBy}
            />
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div className="card card-appetizing mb-5 fade-in">
            <div className="card-body p-4 p-md-5">
              <h2 className="card-title h3 fw-bold mb-3">
                <i className="bi bi-robot me-2 text-primary"></i>
                AI Recommendations Summary
              </h2>
              <p className="lead text-muted mb-0">{aiSummary}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger rounded-4 border-0 shadow-sm fade-in" role="alert">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-3" style={{ fontSize: '1.5rem' }}></i>
              <div>
                <h5 className="alert-heading mb-1">Search Error</h5>
                <p className="mb-0">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-5 fade-in">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Find pleaces to eat for you...</p>
          </div>
        )}

        {/* Restaurant Results */}
        {restaurants.length > 0 && (
          <div className="fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h3 fw-bold mb-0">
                Found {restaurants.length} Restaurant{restaurants.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="row g-4">
              {restaurants.map((restaurant) => (
                <div key={restaurant.id} className="col-12 col-md-6 col-lg-4">
                  <RestaurantCard
                    restaurant={restaurant}
                    userLocation={userLocation || undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-top mt-5 py-4">
        <div className="container text-center">
          <p className="text-muted mb-0">
            <i className="bi bi-robot me-2"></i>
            Powered by Claude AI and Google Places API
          </p>
        </div>
      </footer>
    </div>
  );
}
