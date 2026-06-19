import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

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

    // 2. Obtener configuraciones de la empresa (Twilio credentials)
    const { data: settings } = await supabase
      .from('company_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .limit(1)
      .single();

    // 3. Construir el mensaje SMS
    const message = `Northstar: Tienes una nueva carga asignada (#${loadNumber}). Origen: ${pickupLocation || 'TBD'}. Destino: ${deliveryLocation || 'TBD'}. Abre tu app para mas detalles: https://app.northstarfreightlogistics.com/`;

    // 4. Enviar SMS real vía Twilio si las credenciales están configuradas
    let simulated = true;
    if (settings?.twilio_account_sid && settings?.twilio_auth_token && settings?.twilio_phone_number) {
      try {
        const client = twilio(settings.twilio_account_sid, settings.twilio_auth_token);
        await client.messages.create({
           body: message,
           to: driverPhone,
           from: settings.twilio_phone_number
        });
        simulated = false;
        console.log(`✅ [REAL SMS SENT via Twilio] to ${driverPhone}`);
      } catch (twilioErr: any) {
        console.error('Error from Twilio:', twilioErr);
        // Si falla Twilio, lo marcamos como error
        return NextResponse.json({ success: false, error: `Twilio Error: ${twilioErr.message}` }, { status: 500 });
      }
    } else {
      // Log para el servidor simulando el envío si no hay credenciales
      console.log('\n=========================================');
      console.log(`🚀 [SIMULATED SMS SENT] (No Twilio config)`);
      console.log(`TO: ${driverName} (${driverPhone})`);
      console.log(`MESSAGE: ${message}`);
      console.log('=========================================\n');
    }

    return NextResponse.json({ 
      success: true, 
      message: simulated ? 'SMS simulated successfully' : 'Real SMS sent successfully',
      simulated: simulated,
      sentTo: driverPhone
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
