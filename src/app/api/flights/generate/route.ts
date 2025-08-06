import { NextRequest, NextResponse } from 'next/server';
import { 
  generateExpediaFlightUrl, 
  getAffiliateConfig,
  validateFlightParams,
  type FlightSearchParams 
} from '@/lib/expedia-affiliate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the flight parameters
    const validation = validateFlightParams(body);
    
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid flight parameters',
        validationErrors: validation.errors
      }, { status: 400 });
    }

    // Generate affiliate IDs if not provided
    const affiliateConfig = getAffiliateConfig();

    // Create complete params object
    const params: FlightSearchParams = {
      ...body
    };

    // Generate the Expedia URL
    const expediaUrl = generateExpediaFlightUrl(params);

    return NextResponse.json({
      success: true,
      url: expediaUrl,
      params: {
        ...params,
        // Show affiliate config being used
        affiliateConfig
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Flight URL generation error:', error);
    return NextResponse.json({
      error: 'Failed to generate flight URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Flight URL Generator API',
      endpoints: {
        'POST /api/flights/generate': 'Generate flight search URL with provided parameters'
      },
      requiredParams: [
        'tripType',
        'departureAirport',
        'departureCity', 
        'departureCode',
        'arrivalAirport',
        'arrivalCity',
        'arrivalCode',
        'departureDate',
        'adults'
      ],
      optionalParams: [
        'returnDate',
        'children',
        'childrenAges',
        'infants', 
        'infantAges',
        'infantInLap',
        'cabinClass',
        'affiliateId',
        'subId'
      ]
    });

  } catch (error) {
    console.error('Flight API error:', error);
    return NextResponse.json({
      error: 'API error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
