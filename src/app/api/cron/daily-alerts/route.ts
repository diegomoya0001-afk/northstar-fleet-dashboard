import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic'; // Prevent caching of this cron route

export async function GET(request: Request) {
  try {
    // 1. Fetch expiring documents (within next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateStr = thirtyDaysFromNow.toISOString().split('T')[0];
    
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .or(`expiry_date.lte.${dateStr},expiration_date.lte.${dateStr}`);

    if (docError) throw docError;

    // 2. Fetch expiring fixed costs by checking due_day
    const { data: allCosts, error: costError } = await supabase
      .from('fixed_costs')
      .select('*')
      .gte('expiration_date', new Date().toISOString().split('T')[0]);

    if (costError) throw costError;

    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const { data: currentPayments, error: paymentError } = await supabase
      .from('fixed_cost_payments')
      .select('fixed_cost_id')
      .eq('month_year', currentMonthStr);

    if (paymentError) throw paymentError;

    const paidCostIds = new Set(currentPayments?.map((p: any) => p.fixed_cost_id) || []);

    const todayDay = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    const costs = allCosts?.filter((cost: any) => {
        if (!cost.due_day) return false;
        if (paidCostIds.has(cost.id)) return false; // Ignore if already paid this month
        if (todayDay > cost.due_day) return true; // Past due this month
        let diff = cost.due_day - todayDay;
        if (diff < 0) diff += daysInMonth; // Next month rollover
        return diff <= 5; // Due within 5 days
    }) || [];

    const adminEmail = process.env.ADMIN_EMAIL || 'diegomoya0001@gmail.com';

    // If nothing to alert, don't send an email
    if ((!documents || documents.length === 0) && (!costs || costs.length === 0)) {
       return NextResponse.json({ message: 'No alerts to send today.' });
    }

    // 3. Construct HTML Email
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-[600px]; margin: 0 auto; color: #333;">
         <h1 style="color: #1a1a1a; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">NorthStar Fleet Daily Alerts</h1>
         <p>Here is your daily summary of upcoming expirations and pending payments.</p>
    `;

    if (documents && documents.length > 0) {
       htmlContent += `
         <h2 style="color: #eab308; margin-top: 30px;">⚠️ Expiring Documents (${documents.length})</h2>
         <ul style="list-style-type: none; padding: 0;">
       `;
       documents.forEach((doc: any) => {
          const docDate = doc.expiry_date || doc.expiration_date;
          if (!docDate) return;
          const isExpired = new Date(docDate) < new Date();
          const color = isExpired ? '#ef4444' : '#eab308';
          const truckText = doc.entity_type === 'vehicle' ? `(Vehicle ID: ${doc.entity_id})` : '';
          htmlContent += `
             <li style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
               <strong>${doc.doc_type || 'Document'}</strong> ${truckText} <br/>
               <span style="color: ${color}; font-weight: bold;">
                 ${isExpired ? 'EXPIRED ON' : 'Expires on'}: ${docDate}
               </span>
               <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Notes: ${doc.notes || 'None'}</p>
             </li>
          `;
       });
       htmlContent += `</ul>`;
    }

    if (costs && costs.length > 0) {
       htmlContent += `
         <h2 style="color: #ef4444; margin-top: 30px;">💰 Pending Fixed Costs (${costs.length})</h2>
         <ul style="list-style-type: none; padding: 0;">
       `;
       costs.forEach((cost: any) => {
          const isPastDue = todayDay > cost.due_day;
          const color = isPastDue ? '#ef4444' : '#f97316';
          htmlContent += `
             <li style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
               <strong>${cost.name}</strong> - $${cost.monthly_amount} <br/>
               <span style="color: ${color}; font-weight: bold;">
                 ${isPastDue ? 'PAST DUE (Day ' + cost.due_day + ')' : 'Due on day: ' + cost.due_day + ' of the month'}
               </span>
               <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Provider: ${cost.provider || 'N/A'}</p>
             </li>
          `;
       });
       htmlContent += `</ul>`;
    }

    htmlContent += `
         <div style="margin-top: 40px; font-size: 12px; color: #9ca3af; border-top: 1px solid #eaeaea; padding-top: 20px;">
            <p>This is an automated message from the Fleet Dashboard.</p>
         </div>
      </div>
    `;

    // 4. Send Email via Resend
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: adminEmail,
      subject: '🚨 FleetHQ Daily Alerts: Expirations & Payments',
      html: htmlContent,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Alerts sent successfully.', resend: data });
  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
