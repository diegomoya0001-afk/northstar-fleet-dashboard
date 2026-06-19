import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to simulate SMS notification in the server logs
function simulateSms(phoneNumber: string, message: string) {
  console.log(`\n\n========================================`);
  console.log(`[SMS SIMULATION - Twilio Backend]`);
  console.log(`To: ${phoneNumber}`);
  console.log(`Message: ${message}`);
  console.log(`========================================\n\n`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vehicle_id, odometer, fault_codes } = body;

    if (!vehicle_id) {
      return NextResponse.json({ error: 'Missing vehicle_id' }, { status: 400 });
    }

    // 1. Update Odometer
    if (odometer !== undefined) {
      const { error: vError } = await supabase
        .from('vehicles')
        .update({ current_odometer: odometer })
        .eq('id', vehicle_id);
        
      if (vError) throw vError;
    }

    // 2. Process Fault Codes
    if (fault_codes && Array.isArray(fault_codes) && fault_codes.length > 0) {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('unit_number')
        .eq('id', vehicle_id)
        .single();

      const unitNumber = vehicleData?.unit_number || 'Unknown';

      for (const fault of fault_codes) {
        // Insert active fault
        const { error: fError } = await supabase
          .from('vehicle_fault_codes')
          .insert([{
            vehicle_id: vehicle_id,
            code: fault.code,
            description: fault.description,
            severity: fault.severity || 'high',
            status: 'active'
          }]);

        if (fError) console.error("Error inserting fault:", fError);

        // Send SMS Alert
        simulateSms(
          '+15551234567', // Hardcoded admin number for demo
          `🚨 URGENT: Truck ${unitNumber} reported Engine Fault ${fault.code} (${fault.description}). Severity: ${fault.severity}. Please check dashboard.`
        );
      }
    }

    return NextResponse.json({ success: true, message: 'Telemetry processed' });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
