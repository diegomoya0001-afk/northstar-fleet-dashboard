"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Calendar, ChevronRight, Download, CheckCircle, Clock, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EarningsPage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);

  const [currentPeriod, setCurrentPeriod] = useState({
    start: "Current",
    end: "Period",
    netPay: 0,
    loads: 0
  });

  useEffect(() => {
    const dId = localStorage.getItem('fleet_user_id');
    if (!dId) {
       router.push('/login');
       return;
    }
    setDriverId(dId);
    fetchSettlements(dId);
    fetchCurrentPeriod(dId);
  }, [router]);

  async function fetchCurrentPeriod(dId: string) {
    const { data, error } = await supabase
       .from('load_financials')
       .select('*, loads!inner(assigned_driver_id)')
       .eq('status', 'reconciled')
       .eq('loads.assigned_driver_id', dId);
       
    if (!error && data) {
       const totalPay = data.reduce((acc, row) => acc + Number(row.driver_pay || 0), 0);
       setCurrentPeriod({
         start: "Current",
         end: "Unsettled",
         netPay: totalPay,
         loads: data.length
       });
    }
  }

  async function fetchSettlements(dId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("driver_settlements")
      .select("*")
      .eq("driver_id", dId)
      .order("period_end", { ascending: false });

    if (!error && data) {
      setSettlements(data);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] relative overflow-y-auto hide-scrollbar pb-24">
      {/* Header Area */}
      <div className="bg-[#111] p-6 pt-20 pb-12 rounded-b-[40px] shadow-lg relative z-10">
        <h1 className="text-2xl font-black text-white flex items-center mb-6">
          <Wallet className="w-6 h-6 mr-3 text-success" />
          My Earnings
        </h1>

        {/* Current Active Period Card */}
        <div className="bg-gradient-to-br from-success/20 to-success/5 border border-success/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign className="w-24 h-24 text-success" />
           </div>
           
           <div className="relative z-10">
              <div className="flex items-center text-success font-bold text-sm mb-2 uppercase tracking-wider">
                 <Clock className="w-4 h-4 mr-2" />
                 Current Period (Est.)
              </div>
              <p className="text-xs text-gray-400 mb-4">{currentPeriod.start} to {currentPeriod.end}</p>
              
              <div className="text-5xl font-black text-white mb-2">
                 ${currentPeriod.netPay.toFixed(2)}
              </div>
              
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-success/20">
                 <div className="text-sm text-success/80">
                   <span className="font-bold text-white">{currentPeriod.loads}</span> completed loads
                 </div>
                 <div className="text-xs bg-success/20 text-success px-3 py-1 rounded-full font-bold">
                   PENDING CUTOFF
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* History Area */}
      <div className="p-4 -mt-6 relative z-20">
         <h2 className="text-lg font-bold text-white mb-4 pl-2 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-gray-400" />
            Settlement History
         </h2>

         {loading ? (
            <div className="flex justify-center p-10">
               <div className="w-8 h-8 border-2 border-success border-t-transparent rounded-full animate-spin"></div>
            </div>
         ) : settlements.length === 0 ? (
            <div className="bg-[#1a1a1a] rounded-3xl p-8 text-center border border-white/5">
               <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
               <p className="text-gray-400">No past settlements found.</p>
            </div>
         ) : (
            <div className="space-y-3">
               {settlements.map((settlement) => (
                 <div key={settlement.id} className="bg-[#1a1a1a] border border-white/5 hover:border-success/30 rounded-2xl p-4 transition flex items-center justify-between group cursor-pointer" onClick={() => setSelectedSettlement(settlement)}>
                    <div>
                       <div className="text-xs text-gray-500 font-bold mb-1 uppercase">
                          {settlement.period_start} - {settlement.period_end}
                       </div>
                       <div className="font-black text-lg text-white">
                          ${Number(settlement.net_payout).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                       </div>
                       <div className="flex items-center mt-1">
                          {settlement.status === 'paid' ? (
                             <span className="text-[10px] flex items-center text-success font-bold bg-success/10 px-2 py-0.5 rounded">
                                <CheckCircle className="w-3 h-3 mr-1" /> PAID
                             </span>
                          ) : (
                             <span className="text-[10px] flex items-center text-warning font-bold bg-warning/10 px-2 py-0.5 rounded">
                                <Clock className="w-3 h-3 mr-1" /> PROCESSING
                             </span>
                          )}
                       </div>
                    </div>

                    <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-success/20 group-hover:text-success transition">
                       <ChevronRight className="w-5 h-5" />
                    </button>
                 </div>
               ))}
            </div>
         )}
      </div>

      {/* Settlement Details Modal */}
      {selectedSettlement && (
         <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95">
               <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-bold text-white">Settlement Details</h2>
                  <button onClick={() => setSelectedSettlement(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                     <span className="text-gray-400">Gross Pay (Loads)</span>
                     <span className="font-bold text-white">${Number(selectedSettlement.total_gross_pay || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                     <span className="text-gray-400">Deductions (Fuel)</span>
                     <span className="font-bold text-danger">-${Number(selectedSettlement.deductions || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                     <span className="font-bold text-gray-300">Net Payout</span>
                     <span className="text-2xl font-black text-success">${Number(selectedSettlement.net_payout || 0).toFixed(2)}</span>
                  </div>
               </div>
               <button 
                  onClick={() => setSelectedSettlement(null)} 
                  className="w-full mt-8 bg-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/20 transition"
               >
                  Close
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
