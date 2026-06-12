import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos el Service Role Key para poder leer todos los datos de los usuarios (incluso si RLS los protege)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: Request) {
  try {
    const { driverId, loadNumber, pickupLocation, deliveryLocation } = await request.json();

    if (!driverId || !loadNumber) {
      return NextResponse.json({ success: false, error: 'Missing driverId or loadNumber' }, { status: 400 });
    }

    // 1. Obtener la información del conductor desde Supabase
    const { data: driver, error } = await supabase
      .from('users')
      .select('first_name, last_name, phone')
      .eq('id', driverId)
      .single();

    if (error || !driver) {
      console.error('Error fetching driver:', error);
      return NextResponse.json({ success: false, error: 'Driver not found' }, { status: 404 });
    }

    const driverName = `${driver.first_name} ${driver.last_name}`;
    const driverPhone = driver.phone || 'Unknown Phone';

    // 2. Construir el mensaje SMS
    const message = `Northstar: Tienes una nueva carga asignada (#${loadNumber}). Origen: ${pickupLocation || 'TBD'}. Destino: ${deliveryLocation || 'TBD'}. Abre tu app para mas detalles: https://app.northstarfreightlogistics.com/`;

    // 3. Simular el envío vía Twilio (Aquí iría la lógica real de Twilio)
    /*
      const twilio = require('twilio');
      const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
         body: message,
         to: driverPhone, // Text this number
         from: process.env.TWILIO_PHONE_NUMBER // From a valid Twilio number
      });
    */

    // Log para el servidor de desarrollo/producción simulando el envío
    console.log('\n=========================================');
    console.log(`🚀 [SIMULATED SMS SENT]`);
    console.log(`TO: ${driverName} (${driverPhone})`);
    console.log(`MESSAGE: ${message}`);
    console.log('=========================================\n');

    return NextResponse.json({ 
      success: true, 
      message: 'SMS sent successfully',
      simulated: true,
      sentTo: driverPhone
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
