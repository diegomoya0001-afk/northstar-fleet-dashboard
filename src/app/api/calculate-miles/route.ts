import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GOOGLE_MAPS_API_KEY is not configured in .env.local' 
      }, { status: 500 });
    }

    // Call Google Maps Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error("Google Maps API Error:", data.error_message || data.status);
      return NextResponse.json({ error: data.error_message || 'Failed to calculate distance' }, { status: 500 });
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return NextResponse.json({ error: `Route ${element.status.toLowerCase()}` }, { status: 400 });
    }

    // element.distance.value is in meters, element.distance.text is like "1,234 mi"
    // We'll parse the exact value in miles: 1 meter = 0.000621371 miles
    const miles = Math.round(element.distance.value * 0.000621371);

    return NextResponse.json({ success: true, miles });

  } catch (error: any) {
    console.error("Calculate Miles Error:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
