'use client';

import Script from 'next/script';
import { useState, useEffect } from 'react';

export default function GoogleMapsScript() {
  const [isClient, setIsClient] = useState(false);

  // Ensure this only runs on the client side to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLoad = () => {
    console.log('Google Maps API loaded successfully');
    (window as unknown as { googleMapsLoaded: boolean }).googleMapsLoaded = true;
    window.dispatchEvent(new Event('googleMapsLoaded'));
    
    // Inject additional dark mode styles for Google Places autocomplete
    if (typeof document !== 'undefined') {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const injectDarkModeStyles = () => {
        // Check if dark mode styles are already injected
        if (document.getElementById('google-places-dark-mode')) return;
        
        const style = document.createElement('style');
        style.id = 'google-places-dark-mode';
        style.textContent = `
          @media (prefers-color-scheme: dark) {
            .pac-container {
              background-color: #2D3748 !important;
              border: 1px solid #4A5568 !important;
              box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4) !important;
              border-radius: 8px !important;
            }
            
            .pac-item {
              background-color: #2D3748 !important;
              color: #F7FAFC !important;
              border-color: #4A5568 !important;
              padding: 12px 16px !important;
            }
            
            .pac-item:hover,
            .pac-item-selected {
              background-color: #4A5568 !important;
              color: #F7FAFC !important;
            }
            
            .pac-item-query {
              color: #F7FAFC !important;
              font-weight: 600 !important;
            }
            
            .pac-matched {
              color: #E2E8F0 !important;
              font-weight: 700 !important;
            }
            
            .pac-icon {
              background-position: 0 0;
              background-size: 16px 16px;
            }
            
            .pac-logo:after {
              background-color: #2D3748 !important;
            }
          }
        `;
        document.head.appendChild(style);
      };
      
      // Inject styles immediately if in dark mode
      if (darkModeMediaQuery.matches) {
        injectDarkModeStyles();
      }
      
      // Listen for dark mode changes
      darkModeMediaQuery.addEventListener('change', injectDarkModeStyles);
    }
  };

  // Only render the Script component on the client side
  if (!isClient) {
    return null;
  }

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&v=weekly&loading=async`}
      strategy="afterInteractive"
      onLoad={handleLoad}
      onError={(e) => {
        console.error('Failed to load Google Maps API:', e);
        (window as unknown as { googleMapsLoadError: boolean }).googleMapsLoadError = true;
      }}
    />
  );
}
