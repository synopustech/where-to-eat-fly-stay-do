'use client';

import Image from 'next/image';

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

interface RestaurantCardProps {
  restaurant: Restaurant;
  userLocation?: {
    lat: number;
    lng: number;
  };
}

export default function RestaurantCard({ restaurant, userLocation }: RestaurantCardProps) {
  
  const calculateTravelTime = () => {
    if (!userLocation || !restaurant.geometry) return null;
    
    // Simple distance calculation (approximate)
    const distance = Math.sqrt(
      Math.pow(restaurant.geometry.lat - userLocation.lat, 2) + 
      Math.pow(restaurant.geometry.lng - userLocation.lng, 2)
    ) * 111; // Convert to km (rough approximation)
    
    const walkingTime = Math.round(distance * 12); // ~12 minutes per km walking
    const drivingTime = Math.round(distance * 2); // ~2 minutes per km driving
    
    return { distance: distance.toFixed(1), walkingTime, drivingTime };
  };

  const getDirectionsUrl = () => {
    // Create a mobile-friendly directions URL
    if (userLocation && restaurant.geometry) {
      // Use directions API with user's current location as origin
      return `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${restaurant.geometry.lat},${restaurant.geometry.lng}`;
    } else if (restaurant.geometry) {
      // Fallback to directions without origin (will prompt user for location)
      return `https://www.google.com/maps/dir//${restaurant.geometry.lat},${restaurant.geometry.lng}`;
    } else {
      // Fallback to search by name and address
      const query = encodeURIComponent(`${restaurant.name} ${restaurant.address}`);
      return `https://www.google.com/maps/search/${query}`;
    }
  };

  const handleDirectionsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const directionsUrl = getDirectionsUrl();
    
    // Always open Google Maps in browser - simple and consistent across all devices
    window.open(directionsUrl, '_blank');
  };

  const getCurrentDayHours = () => {
    if (!restaurant.openingHours || restaurant.openingHours.length === 0) return null;
    
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[today.getDay()];
    
    // Find today's hours from the opening hours array
    const todayHours = restaurant.openingHours.find(hours => 
      hours.toLowerCase().includes(currentDay.toLowerCase())
    );
    
    if (todayHours) {
      // Extract just the time part (remove day name)
      const timeMatch = todayHours.match(/\d{1,2}:\d{2}\s*[AP]M.*$/i);
      return timeMatch ? timeMatch[0] : todayHours;
    }
    
    // Fallback to first available hours if today not found
    return restaurant.openingHours[0];
  };

  const travelInfo = calculateTravelTime();
  const _currentDayHours = getCurrentDayHours();

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <i 
          key={i} 
          className={`bi bi-star${i <= Math.floor(rating) ? '-fill' : ''} star-rating`}
          style={{ fontSize: '1.1rem', marginRight: '2px' }}
        ></i>
      );
    }
    return stars;
  };

  const getPriceDisplay = (level?: number) => {
    if (!level) return 'Price not available';
    const symbols = '$'.repeat(level);
    const labels = ['Budget', 'Moderate', 'Expensive', 'Very Expensive'];
    return `${symbols} (${labels[level - 1]})`;
  };

  return (
    <div className="card card-appetizing restaurant-card h-100 fade-in">
      {/* Restaurant Image */}
      <div className="restaurant-image bg-appetizing-gradient position-relative">
        {restaurant.photoUrl ? (
          <Image
            src={restaurant.photoUrl}
            alt={restaurant.name}
            width={400}
            height={250}
            className="card-img-top h-100 w-100"
            style={{ objectFit: 'cover', height: '250px' }}
          />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-white">
            <div className="text-center">
              <i className="bi bi-shop" style={{ fontSize: '4rem', opacity: 0.7 }}></i>
              <p className="mt-2 fw-bold">{restaurant.cuisine || 'Restaurant'}</p>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="position-absolute top-0 end-0 m-3">
          <span className={`badge ${restaurant.realTimeStatus?.isOpen ? 'status-badge-open' : 'status-badge-closed'} px-3 py-2 rounded-pill`}>
            <i className={`bi bi-circle-fill me-1`}></i>
            {restaurant.realTimeStatus?.isOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>

        {/* Travel Info */}
        {travelInfo ? (
          <div className="position-absolute top-0 start-0 m-3">
            <span className="badge bg-dark bg-opacity-75 px-3 py-2 rounded-pill">
              <i className="bi bi-geo-alt-fill me-1"></i>
              {travelInfo.distance}km • {travelInfo.drivingTime}min drive
            </span>
          </div>
        ) : restaurant.distance !== undefined ? (
          <div className="position-absolute top-0 start-0 m-3">
            <span className="badge bg-dark bg-opacity-75 px-3 py-2 rounded-pill">
              <i className="bi bi-geo-alt-fill me-1"></i>
              {restaurant.distance.toFixed(1)}km away
            </span>
          </div>
        ) : null}
      </div>

      <div className="card-body p-4">
        {/* Header */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h3 className="card-title h4 fw-bold text-charcoal-gray mb-0" style={{ lineHeight: '1.2' }}>
              {restaurant.name}
            </h3>
            <div className="d-flex align-items-center bg-light-cream rounded-3 px-2 py-1">
              {restaurant.rating > 0 ? (
                <>
                  {renderStars(restaurant.rating)}
                  <span className="fw-bold ms-1 text-charcoal-gray">{restaurant.rating}</span>
                </>
              ) : (
                <span className="text-muted small">No rating</span>
              )}
            </div>
          </div>

          {/* AI Recommendation */}
          {restaurant.aiRecommendation && (
            <div className="bg-light-cream rounded-3 p-2 mb-2">
              <div className="d-flex align-items-start">
                <i className="bi bi-robot text-flame-scarlet me-2" style={{ fontSize: '0.9rem' }}></i>
                <span className="text-charcoal-gray fst-italic" style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
                  {restaurant.aiRecommendation}
                </span>
              </div>
            </div>
          )}
          
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              {restaurant.cuisine && (
                <span className="badge bg-fresh-green text-white rounded-pill px-3 py-2">
                  <i className="bi bi-utensils me-1"></i>
                  {restaurant.cuisine}
                </span>
              )}
              
              {/* Distance Display */}
              {(travelInfo || restaurant.distance !== undefined) && (
                <span className="badge bg-charcoal-gray text-white rounded-pill px-3 py-2">
                  <i className="bi bi-geo-alt me-1"></i>
                  {travelInfo ? `${travelInfo.distance}km` : `${restaurant.distance?.toFixed(1)}km`}
                </span>
              )}
            </div>
            
            <div className="d-flex align-items-center text-harvest-gold price-level">
              <i className="bi bi-currency-dollar me-1"></i>
              <span className="fw-bold">{getPriceDisplay(restaurant.priceLevel)}</span>
            </div>
          </div>
        </div>

        {/* Address and Hours */}
        <div className="mb-4">
          <div className="bg-light-cream rounded-3 p-3 mb-3">
            <div className="d-flex align-items-start">
              <i className="bi bi-geo-fill text-charcoal-gray me-2 mt-1"></i>
              <span className="text-charcoal-gray fw-medium">{restaurant.address}</span>
            </div>
          </div>
          
          {restaurant.realTimeStatus && (
            <div className={`rounded-3 p-3 ${restaurant.realTimeStatus.isOpen ? 'bg-fresh-green bg-opacity-10' : 'bg-warning bg-opacity-10'}`}>
              <div className="d-flex align-items-center">
                <i className={`bi ${restaurant.realTimeStatus.isOpen ? 'bi-clock-fill' : 'bi-clock'} text-charcoal-gray me-2`}></i>
                <div className="flex-grow-1">
                  <span className="text-charcoal-gray fw-bold d-block">
                    {restaurant.realTimeStatus.message}
                  </span>
                  {restaurant.realTimeStatus.currentPeriod && (
                    <small className="text-charcoal-gray opacity-75">
                      {restaurant.realTimeStatus.currentPeriod.isOvernightPeriod ? (
                        <>
                          <i className="bi bi-moon-fill me-1"></i>
                          {restaurant.realTimeStatus.currentPeriod.day}: {restaurant.realTimeStatus.currentPeriod.hours}
                        </>
                      ) : (
                        <>
                          {restaurant.realTimeStatus.currentPeriod.day}: {restaurant.realTimeStatus.currentPeriod.hours}
                        </>
                      )}
                    </small>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="row g-2">
          <div className="col-6">
            <button
              onClick={handleDirectionsClick}
              className="btn btn-flame-scarlet w-100 py-3 fw-bold rounded-3 d-flex align-items-center justify-content-center"
              type="button"
            >
              <i className="bi bi-navigation-fill me-2"></i>
              Directions
            </button>
          </div>
          
          <div className="col-3">
            {restaurant.phone ? (
              <a
                href={`tel:${restaurant.phone}`}
                className="btn btn-fresh-green w-100 py-3 rounded-3 d-flex align-items-center justify-content-center text-white"
                title="Call Restaurant"
              >
                <i className="bi bi-telephone-fill" style={{ fontSize: '1.1rem' }}></i>
              </a>
            ) : (
              <div className="btn btn-light w-100 py-3 rounded-3 d-flex align-items-center justify-content-center border-2 disabled">
                <i className="bi bi-telephone" style={{ fontSize: '1.1rem', opacity: '0.5' }}></i>
              </div>
            )}
          </div>

          <div className="col-3">
            {restaurant.website ? (
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-harvest-gold w-100 py-3 rounded-3 d-flex align-items-center justify-content-center text-jet-black"
                title="Visit Website"
              >
                <i className="bi bi-globe" style={{ fontSize: '1.1rem' }}></i>
              </a>
            ) : (
              <div className="btn btn-light w-100 py-3 rounded-3 d-flex align-items-center justify-content-center border-2 disabled">
                <i className="bi bi-globe" style={{ fontSize: '1.1rem', opacity: '0.5' }}></i>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
