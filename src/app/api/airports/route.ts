import { NextRequest, NextResponse } from 'next/server';
import { searchAirports } from '@/lib/airports';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: [],
        message: 'Please provide at least 2 characters for search'
      });
    }

    const results = await searchAirports(query);
    
    return NextResponse.json({
      results,
      count: results.length,
      query
    });

  } catch (error) {
    console.error('Airport search error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search airports',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
