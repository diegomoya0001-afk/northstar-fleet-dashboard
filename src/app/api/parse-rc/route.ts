import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY is not set in .env.local. Please add it to enable real AI extraction.' 
      }, { status: 500 });
    }

    // Convert file to base64 using edge-compatible method
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    
    // Determine mime type
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
      else if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
      else mimeType = 'application/pdf'; // default fallback
    }

    // List of models to try in order of preference
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'];
    let errors: any[] = [];

    for (const modelName of modelsToTry) {
      let retries = 2;
      while (retries > 0) {
        try {
          console.log(`Trying model: ${modelName} for rate confirmation`);
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `Extract the following details from this Rate Confirmation document and return ONLY a raw JSON object.
                    Do not include markdown blocks like \`\`\`json.
                    Fields needed:
                    - "loadNumber": The load number or reference number (e.g. "25AF801").
                    - "brokerName": The name of the broker or company (e.g. "COUGAR EXPRESS / Arafet Freight").
                    - "brokerMC": The broker's MC number (e.g. "248449").
                    - "rate": The gross rate or shipment pay, just the number as a string without symbols (e.g. "2800.00").
                    - "stops": An array of all stops (pickups and deliveries) in chronological order. Each stop must be an object with:
                        - "type": either "pickup" or "delivery".
                        - "location": City and State (e.g. "Norristown, PA").
                        - "address": The exact street address including Zip Code.
                        - "date": The date formatted as YYYY-MM-DD.
                        - "status": Always set to "pending".
                    - "pickupAddress": Keep for fallback, the first pickup address.
                    - "pickupLocation": Keep for fallback, the first pickup location.
                    - "pickupDate": Keep for fallback, the first pickup date.
                    - "deliveryAddress": Keep for fallback, the last delivery address.
                    - "deliveryLocation": Keep for fallback, the last delivery location.
                    - "deliveryDate": Keep for fallback, the last delivery date.
                    - "weight": The total weight of the load in pounds, just the number.
                    - "loadedMiles": The loaded miles or distance, just the number.
                    - "notes": Any special instructions or notes.
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
            
            if (response.status === 503 || response.status === 429) {
              retries--;
              if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000));
                continue; // retry same model
              }
            }
            
            errors.push(errorText);
            break; // Try next model
          }

          const aiData = await response.json();
          const textResponse = aiData.candidates[0].content.parts[0].text;
          
          let extractedData;
          try {
             extractedData = JSON.parse(textResponse);
          } catch (e) {
             const cleanedText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
             extractedData = JSON.parse(cleanedText);
          }
          
          return NextResponse.json({ success: true, data: extractedData });

        } catch (err: any) {
          errors.push(err.message);
          console.error(`Error with model ${modelName}:`, err.message);
          break; // try next model
        }
      }
    }

    // If all models failed
    console.error("All Gemini models failed. Errors:", errors);
    return NextResponse.json({ error: `AI Processing failed. Last error: ${errors[errors.length - 1]}` }, { status: 503 });

  } catch (error: any) {
    console.error("Parse RC Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 });
  }
}
