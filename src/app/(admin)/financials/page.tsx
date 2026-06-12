"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Activity, Truck, ChevronDown, PieChart, Shield, Calculator, X, Plus, Receipt, Calendar } from 'lucide-react';

type TimeFilter = 'week' | 'biweek' | 'month' | 'ytd' | 'all';

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<'fixed' | 'opex'>('fixed');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  
  const [loads, setLoads] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  async function fetchFinancialData() {
    setLoading(true);
    
    // Fetch completed loads
    const { data: loadsData, error: loadsError } = await supabase
      .from('loads')
      .select('*')
      .in('status', ['delivered', 'invoiced', 'paid'])
      .order('delivery_date', { ascending: false });

    // Fetch fuel logs that are attached to loads
    const { data: fuelData, error: fuelError } = await supabase
      .from('fuel_logs')
      .select('*')
      .not('load_id', 'is', null);

    if (!loadsError && loadsData) setLoads(loadsData);
    if (!fuelError && fuelData) setFuelLogs(fuelData);
    
    setLoading(false);
  }

  // Filter loads based on timeFilter
  const getFilteredLoads = () => {
    const now = new Date();
    return loads.filter(load => {
      if (!load.delivery_date) return false;
      const loadDate = new Date(load.delivery_date);
      
      if (timeFilter === 'all') return true;
      if (timeFilter === 'ytd') return loadDate.getFullYear() === now.getFullYear();
      
      const diffTime = Math.abs(now.getTime() - loadDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (timeFilter === 'week') return diffDays <= 7;
      if (timeFilter === 'biweek') return diffDays <= 14;
      if (timeFilter === 'month') return diffDays <= 30;
      
      return true;
    });
  };

  const filteredLoads = getFilteredLoads();

  // Aggregate Data
  let totalGross = 0;
  let totalDispatch = 0;
  let totalFactoring = 0;
  let totalDriverPay = 0;
  let totalEmployerTaxes = 0;
  let totalMaintenance = 0;
  let totalFuel = 0;

  const loadsWithProfitability = filteredLoads.map(load => {
    const rate = load.rate || 0;
    const dispatchFee = rate * 0.05;
    const driverPay = rate * 0.25;
    const driverTaxes = driverPay * 0.0765;
    const factoringFee = (rate * 0.025) + 5;
    const maintReserve = rate * 0.05;
    
    // Sum fuel for this specific load
    const loadFuel = fuelLogs
      .filter(f => f.load_id === load.id)
      .reduce((sum, f) => sum + Number(f.total_cost || 0), 0);

    const totalExpenses = dispatchFee + driverPay + driverTaxes + factoringFee + maintReserve + loadFuel;
    const netProfit = rate - totalExpenses;

    // Accumulate globals
    totalGross += rate;
    totalDispatch += dispatchFee;
    totalFactoring += factoringFee;
    totalDriverPay += driverPay;
    totalEmployerTaxes += driverTaxes;
    totalMaintenance += maintReserve;
    totalFuel += loadFuel;

    return {
      ...load,
      profitability: {
        rate, dispatchFee, driverPay, driverTaxes, factoringFee, maintReserve, loadFuel, totalExpenses, netProfit
      }
    };
  });

  const totalOpex = totalDispatch + totalFactoring + totalDriverPay + totalEmployerTaxes + totalFuel; 
  // Note: Maintenance is an escrow/reserve, usually subtracted to find Net Profit, but let's keep it separate for clarity
  const totalNetProfit = totalGross - totalOpex - totalMaintenance;

  const MetricCard = ({ title, amount, subtext, type = 'neutral', loading }: any) => (
    <div className="glass-panel p-6 flex flex-col relative overflow-hidden group">
      <div className="text-gray-400 text-sm font-semibold mb-2">{title}</div>
      {loading ? (
        <div className="h-9 w-32 bg-white/10 rounded animate-pulse"></div>
      ) : (
        <div className={`text-3xl font-bold ${
          type === 'positive' ? 'text-success' : 
          type === 'negative' ? 'text-warning' : 
          type === 'blue' ? 'text-blue-400' : 'text-white'
        }`}>
          ${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">{subtext}</div>
    </div>
  );

  const filterLabels = {
    'week': 'Last 7 Days',
    'biweek': 'Last 14 Days',
    'month': 'Last 30 Days',
    'ytd': 'Year to Date',
    'all': 'All Time'
  };

  return (
    <div className="h-full flex flex-col gap-6 relative overflow-y-auto hide-scrollbar">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financials & P&L</h1>
          <p className="text-gray-400 mt-1">Real-time profitability and financial reconciliation</p>
        </div>
        
        {/* Time Filter */}
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
          {(['week', 'biweek', 'month', 'ytd', 'all'] as TimeFilter[]).map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center ${timeFilter === tf ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              {timeFilter === tf && <Calendar className="w-4 h-4 mr-2" />}
              {filterLabels[tf]}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard loading={loading} title={`Gross Revenue (${filterLabels[timeFilter]})`} amount={totalGross} subtext={`${filteredLoads.length} loads completed`} type="positive" />
        <MetricCard loading={loading} title="Total Operating Expenses" amount={totalOpex} subtext="Fuel, Driver Pay, Factoring, Dispatch" type="negative" />
        <MetricCard loading={loading} title="Maintenance Escrow (5%)" amount={totalMaintenance} subtext="Reserved for future repairs" type="blue" />
        <MetricCard loading={loading} title={`Net Profit (${filterLabels[timeFilter]})`} amount={totalNetProfit} subtext={`Clean profit after all deductions${totalGross > 0 ? ` (${((totalNetProfit / totalGross) * 100).toFixed(1)}% Margin)` : ''}`} type="positive" />
      </div>

      <div className="flex gap-6 h-full pb-10">
        {/* Left Column: Fixed Costs & General Expenses (Static for now, will connect to DB later) */}
        <div className="w-[35%] space-y-6 flex flex-col">
          <div className="glass-panel p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center">
                {activeTab === 'fixed' ? <PieChart className="w-5 h-5 mr-2 text-primary"/> : <Receipt className="w-5 h-5 mr-2 text-warning"/>}
                {activeTab === 'fixed' ? 'Monthly Fixed Costs' : 'General OPEX'}
              </h2>
              <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => setActiveTab('fixed')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${activeTab === 'fixed' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                >Fixed</button>
                <button 
                  onClick={() => setActiveTab('opex')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${activeTab === 'opex' ? 'bg-warning text-white' : 'text-gray-500 hover:text-white'}`}
                >OPEX</button>
              </div>
            </div>

            {activeTab === 'fixed' ? (
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div>
                    <div className="font-bold">Commercial Auto Liability</div>
                    <div className="text-xs text-gray-400">Progressive / Paid Monthly</div>
                  </div>
                  <div className="font-mono text-warning font-bold">-$1,850.00</div>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div>
                    <div className="font-bold">Truck Financing (TRK-105)</div>
                    <div className="text-xs text-gray-400">PACCAR Financial</div>
                  </div>
                  <div className="font-mono text-warning font-bold">-$2,100.00</div>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div>
                    <div className="font-bold">ELD / GPS Subscription</div>
                    <div className="text-xs text-gray-400">Samsara / Motive</div>
                  </div>
                  <div className="font-mono text-warning font-bold">-$45.00</div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="font-bold text-gray-400">Total Fixed Monthly</div>
                  <div className="text-xl font-bold text-white">-$3,995.00</div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-400">Fixed costs are deducted from the global Net Profit at the end of the month, not per load.</p>
                </div>
              </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <Receipt className="w-10 h-10 mb-3 opacity-50" />
                  <p>General OPEX tracking coming soon.</p>
               </div>
            )}
          </div>
        </div>

        {/* Right Column: Arqueo / Load Breakdown */}
        <div className="flex-1">
          <div className="glass-panel p-6 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
              <span className="flex items-center"><Activity className="w-5 h-5 mr-2 text-success"/> Load Reconciliation (Arqueo)</span>
              <span className="text-sm font-normal text-gray-400 bg-white/5 px-3 py-1 rounded-full">{filteredLoads.length} Loads Found</span>
            </h2>
            
            <div className="flex-1 overflow-auto hide-scrollbar pr-2">
              {loading ? (
                 <div className="flex justify-center items-center h-40">
                   <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : filteredLoads.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <p>No completed loads found for {filterLabels[timeFilter].toLowerCase()}.</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {loadsWithProfitability.map(load => (
                    <div key={load.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 hover:bg-white/5 transition group">
                       <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                         <div>
                           <div className="flex items-center gap-3">
                             <span className="font-black text-lg">Load #{load.load_number}</span>
                             <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-success/20 text-success">
                               {load.status}
                             </span>
                           </div>
                           <div className="text-sm text-gray-400 mt-1">{load.pickup_location} &rarr; {load.delivery_location}</div>
                           <div className="text-xs text-gray-500 mt-1">Delivered: {load.delivery_date}</div>
                         </div>
                         <div className="text-right">
                           <div className="text-xs text-gray-500 uppercase font-bold mb-1">Gross</div>
                           <div className="text-2xl font-bold text-success">${load.profitability.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Driver Pay + Taxes</div>
                             <div className="font-mono text-warning font-semibold">
                               -${(load.profitability.driverPay + load.profitability.driverTaxes).toFixed(2)}
                               {load.profitability.rate > 0 && <span className="text-[10px] text-warning/70 ml-2">{(((load.profitability.driverPay + load.profitability.driverTaxes)/load.profitability.rate)*100).toFixed(1)}%</span>}
                             </div>
                          </div>
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Fuel Costs</div>
                             <div className="font-mono text-danger font-semibold">
                               -${load.profitability.loadFuel.toFixed(2)}
                               {load.profitability.rate > 0 && <span className="text-[10px] text-danger/70 ml-2">{((load.profitability.loadFuel/load.profitability.rate)*100).toFixed(1)}%</span>}
                             </div>
                          </div>
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Fees (Factoring+Disp)</div>
                             <div className="font-mono text-warning font-semibold">
                               -${(load.profitability.factoringFee + load.profitability.dispatchFee).toFixed(2)}
                               {load.profitability.rate > 0 && <span className="text-[10px] text-warning/70 ml-2">{(((load.profitability.factoringFee + load.profitability.dispatchFee)/load.profitability.rate)*100).toFixed(1)}%</span>}
                             </div>
                          </div>
                          <div className="bg-success/10 rounded-lg p-2 border border-success/20 text-center flex flex-col justify-center">
                             <div className="text-[10px] text-success uppercase font-bold mb-0.5">Net Profit</div>
                             <div className="font-black text-success text-base">${load.profitability.netProfit.toFixed(2)}</div>
                             {load.profitability.rate > 0 && (
                               <div className="text-[9px] text-success/70 font-bold mt-1">
                                 {((load.profitability.netProfit / load.profitability.rate) * 100).toFixed(1)}% MARGIN
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Summary Footer */}
            {!loading && filteredLoads.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 bg-black/40 rounded-xl p-4 flex justify-between items-center text-sm">
                <span className="text-gray-400">Summary for {filterLabels[timeFilter]}:</span>
                <div className="flex gap-6">
                   <div className="text-right">
                     <span className="text-xs text-gray-500 uppercase mr-2">Total OPEX:</span>
                     <span className="font-mono text-warning font-bold">-${totalOpex.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                   </div>
                   <div className="text-right">
                     <span className="text-xs text-success uppercase font-bold mr-2">Total NET:</span>
                     <span className="font-black text-success text-lg">${totalNetProfit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
