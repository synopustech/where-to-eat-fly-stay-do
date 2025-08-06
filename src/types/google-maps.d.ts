// Global type declarations for Google Maps API
/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
