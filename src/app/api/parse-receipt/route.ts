import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';
    
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (!body.file) return NextResponse.json({ error: 'No file provided in JSON' }, { status: 400 });
      // body.file is a data URL: "data:image/jpeg;base64,/9j/4AAQSk..."
      const parts = body.file.split(',');
      base64Data = parts.length > 1 ? parts[1] : parts[0];
      mimeType = body.mimeType || 'image/jpeg';
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided in FormData' }, { status: 400 });
      }

      // Convert file to base64 using edge-compatible method
      const arrayBuffer = await file.arrayBuffer();
      // Use btoa to convert ArrayBuffer to Base64 in Edge
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = btoa(binary);
      
      // Determine mime type
      mimeType = file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        else mimeType = 'image/jpeg'; // default fallback
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY is not set in .env.local.' 
      }, { status: 500 });
    }

    // List of models to try in order of preference
    const modelsToTry = ['gemini-1.5-flash-latest', 'gemini-flash-latest', 'gemini-1.5-flash'];
    let errors: any[] = [];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName} for fuel receipt`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `Extract the following details from this gas station fuel receipt and return ONLY a raw JSON object.
                  Do not include markdown blocks like \`\`\`json.
                  Fields needed:
                  - "gallons": The total gallons/liters of fuel pumped, just the number as a string (e.g. "50.5").
                  - "pricePerGallon": The price per gallon/liter, just the number as a string (e.g. "3.50").
                  - "totalCost": The total cost paid, just the number as a string (e.g. "150.00").
                  - "gasStation": The name of the gas station (e.g. "Pilot", "Love's", "Chevron"). If not found, return an empty string.
                  - "state": The 2-letter abbreviation of the US State where the purchase was made (e.g. "TX", "FL", "CA"). If not found, return an empty string.
                ` },
                { 
                  inlineData: { 
                    mimeType: mimeType, 
                    data: base64Data 
                  } 
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: "application/json"
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Model ${modelName} failed:`, errorText);
          errors.push(errorText);
          continue; // Try next model
        }

        const aiData = await response.json();
        const textResponse = aiData.candidates[0].content.parts[0].text;
        
        let extractedData;
        try {
           extractedData = JSON.parse(textResponse);
        } catch (e) {
           // Fallback cleanup if model still returns markdown
           const cleanedText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
           extractedData = JSON.parse(cleanedText);
        }
        
        return NextResponse.json(extractedData);

      } catch (err: any) {
        errors.push(err.message);
        console.error(`Error with model ${modelName}:`, err.message);
      }
    }

    return NextResponse.json({ error: 'All Gemini models failed. ' + JSON.stringify(errors) }, { status: 500 });

  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
