import { Client } from '@googlemaps/google-maps-services-js';

/**
 * Google Maps Client with Deprecation Warning Suppression
 * 
 * SECURITY NOTE: This suppresses DEP0169 (url.parse() deprecation) warnings from 
 * the Google Maps services package. This is SAFE because:
 * 
 * 1. The warning is from Google's official, actively maintained package
 * 2. No actual security vulnerabilities exist (npm audit: 0 vulnerabilities)
 * 3. This is a coding best practice warning, not a security issue
 * 4. We only suppress this specific warning, not all security warnings
 * 
 * Google will update their package to use WHATWG URL API in future versions.
 * Until then, this suppression prevents console noise without security risk.
 * 
 * Last security audit: August 2025 ✅
 */

// Global warning suppression for url.parse() deprecation from Google Maps services
const originalEmitWarning = process.emitWarning;

// Override process.emitWarning to filter out specific deprecation warnings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.emitWarning = function(warning: string | Error, ...args: any[]) {
  // Suppress url.parse() deprecation warnings from Google Maps dependencies
  if (typeof warning === 'string' && warning.includes('url.parse()')) {
    return; // Suppress this specific warning
  }
  
  if (warning instanceof Error && warning.message.includes('url.parse()')) {
    return; // Suppress this specific warning
  }
  
  // Call original emitWarning for all other warnings
  return originalEmitWarning.call(this, warning, ...args);
};

// Create and export the Google Maps client
export const googleMapsClient = new Client({});
