import { NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 400 }
      );
    }

    // Test the Google Places API with a simple request
    const googleMapsClient = new Client({});
    
    const response = await googleMapsClient.textSearch({
      params: {
        query: 'restaurant',
        key: apiKey,
      },
    });

    if (response.data.status === 'OK') {
      return NextResponse.json({ 
        status: 'connected', 
        message: 'Google Places API is working'
      });
    } else {
      throw new Error(`API returned status: ${response.data.status}`);
    }

  } catch (error) {
    console.error('Google Places API health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Google Places API connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
