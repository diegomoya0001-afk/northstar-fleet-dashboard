"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign, Activity, PieChart, Receipt, Calendar, BarChart2, Plus, Trash2, Shield, Wrench, Edit2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PinModal from '@/components/PinModal';
import { exportToExcel } from '@/utils/excelExport';

type TimeFilter = 'week' | 'biweek' | 'month' | 'ytd' | 'all';

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<'fixed' | 'opex' | 'summary'>('summary');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  
  const [loads, setLoads] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [fixedCosts, setFixedCosts] = useState<any[]>([]);
  const [shopVisits, setShopVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Fixed Cost state
  const [showAddFixedCost, setShowAddFixedCost] = useState(false);
  const [fcName, setFcName] = useState('');
  const [fcProvider, setFcProvider] = useState('');
  const [fcAmount, setFcAmount] = useState('');
  const [fcDueDay, setFcDueDay] = useState('1');
  const [fcExpirationDate, setFcExpirationDate] = useState('');

  // Edit Fixed Cost state
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editFcName, setEditFcName] = useState('');
  const [editFcProvider, setEditFcProvider] = useState('');
  const [editFcAmount, setEditFcAmount] = useState('');
  const [editFcDueDay, setEditFcDueDay] = useState('1');
  const [editFcExpirationDate, setEditFcExpirationDate] = useState('');
  
  // Payment tracking states
  const [fixedCostPayments, setFixedCostPayments] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingCostId, setPayingCostId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  
  // PIN Modal state for deleting fixed cost
  const [showPinModal, setShowPinModal] = useState(false);
  const [costToDelete, setCostToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, [selectedMonth]); // refetch when selectedMonth changes if needed (or fetch all payments once)

  async function fetchFinancialData() {
    setLoading(true);
    
    // Fetch loads
    const { data: loadsData } = await supabase
      .from('loads')
      .select(`
        *,
        dispatcher:users!dispatcher_id(first_name, last_name, commission_rate, company_name, payment_info, dispatcher_id_number)
      `)
      .in('status', ['delivered', 'invoiced', 'paid'])
      .order('delivery_date', { ascending: false });

    // Fetch fuel
    const { data: fuelData } = await supabase.from('fuel_logs').select('*').not('load_id', 'is', null);
    
    // Fetch fixed costs
    const { data: fixedData } = await supabase.from('fixed_costs').select('*').order('created_at', { ascending: false });
    
    // Fetch shop visits
    const { data: shopData } = await supabase.from('shop_visits').select('*').order('date_in', { ascending: false });

    // Fetch fixed cost payments for the selected month
    const { data: paymentsData } = await supabase
      .from('fixed_cost_payments')
      .select('*')
      .eq('month_year', selectedMonth);

    if (loadsData) setLoads(loadsData);
    if (fuelData) setFuelLogs(fuelData);
    if (fixedData) setFixedCosts(fixedData);
    if (shopData) setShopVisits(shopData);
    if (paymentsData) setFixedCostPayments(paymentsData);
    
    setLoading(false);
  }

  // --- FILTERING ---
  const isWithinFilter = (dateString: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    
    if (timeFilter === 'all') return true;
    if (timeFilter === 'ytd') return date.getFullYear() === now.getFullYear();
    
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (timeFilter === 'week') return diffDays <= 7;
    if (timeFilter === 'biweek') return diffDays <= 14;
    if (timeFilter === 'month') return diffDays <= 30;
    return true;
  };

  const filteredLoads = loads.filter(load => isWithinFilter(load.delivery_date));
  const filteredShopVisits = shopVisits.filter(sv => isWithinFilter(sv.date_in));

  // --- MATH & P&L ---
  let totalGross = 0;
  let totalDispatch = 0;
  let totalFactoring = 0;
  let totalDriverPay = 0;
  let totalEmployerTaxes = 0;
  let totalFuel = 0;
  let totalMiles = 0;

  const loadsWithProfitability = filteredLoads.map(load => {
    const rate = load.rate || 0;
    const dispatchFee = load.dispatcher?.commission_rate != null ? rate * (Number(load.dispatcher.commission_rate) / 100) : rate * 0.05;
    const driverPay = rate * 0.25;
    const driverTaxes = driverPay * 0.0765;
    const factoringFee = (rate * 0.025) + 5;
    const additionalExpenses = Number(load.additional_expenses || 0);
    
    const loadFuel = fuelLogs
      .filter(f => f.load_id === load.id)
      .reduce((sum, f) => sum + Number(f.total_cost || 0), 0);

    const totalLoadOpex = dispatchFee + driverPay + driverTaxes + factoringFee + loadFuel + additionalExpenses;
    const loadGrossMargin = rate - totalLoadOpex;

    totalGross += rate;
    totalDispatch += dispatchFee;
    totalFactoring += factoringFee;
    totalDriverPay += driverPay;
    totalEmployerTaxes += driverTaxes;
    totalFuel += loadFuel;
    totalMiles += Number(load.loaded_miles || 0) + Number(load.deadhead_miles || 0);

    return {
      ...load,
      profitability: { rate, dispatchFee, driverPay, driverTaxes, factoringFee, loadFuel, additionalExpenses, totalLoadOpex, loadGrossMargin }
    };
  });

  const totalLoadOpex = totalDispatch + totalFactoring + totalDriverPay + totalEmployerTaxes + totalFuel; 
  const grossMargin = totalGross - totalLoadOpex;

  // Repairs
  const totalRepairs = filteredShopVisits.reduce((sum, sv) => sum + Number(sv.total_cost || 0), 0);

  // Fixed Costs Proration
  const totalMonthlyFixed = fixedCosts.reduce((sum, fc) => sum + Number(fc.monthly_amount || 0), 0);
  let prorationFactor = 1;
  const now = new Date();
  
  if (timeFilter === 'week') prorationFactor = 7 / 30.44;
  else if (timeFilter === 'biweek') prorationFactor = 14 / 30.44;
  else if (timeFilter === 'month') prorationFactor = 1;
  else if (timeFilter === 'ytd') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysYTD = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    prorationFactor = daysYTD / 30.44;
  }
  else if (timeFilter === 'all') {
    // If all time, let's do 12 months for now, or calculate dynamically if we want.
    prorationFactor = 12; 
  }
  
  const proratedFixedCosts = totalMonthlyFixed * prorationFactor;
  
  // True Net Profit
  const trueNetProfit = grossMargin - totalRepairs - proratedFixedCosts;

  // --- ACTIONS ---
  async function handleAddFixedCost() {
    if (!fcName || !fcAmount) return;
    const { error } = await supabase.from('fixed_costs').insert([{
      name: fcName,
      provider: fcProvider,
      monthly_amount: parseFloat(fcAmount),
      due_day: parseInt(fcDueDay) || 1,
      expiration_date: fcExpirationDate || null
    }]);
    if (!error) {
      setFcName(''); setFcProvider(''); setFcAmount(''); setFcDueDay('1'); setFcExpirationDate(''); setShowAddFixedCost(false);
      fetchFinancialData();
    } else {
      alert("Error saving fixed cost: " + error.message);
    }
  }

  async function handleUpdateFixedCost() {
    if (!editingCostId || !editFcName || !editFcAmount) return;
    const { error } = await supabase.from('fixed_costs').update({
      name: editFcName,
      provider: editFcProvider,
      monthly_amount: parseFloat(editFcAmount),
      due_day: parseInt(editFcDueDay) || 1,
      expiration_date: editFcExpirationDate || null
    }).eq('id', editingCostId);
    
    if (!error) {
      setEditingCostId(null);
      fetchFinancialData();
    } else {
      alert("Error updating fixed cost: " + error.message);
    }
  }

  async function handleMarkPaid() {
    if (!payingCostId || !paymentAmount || !paymentDate) return;
    setUploadingPayment(true);
    let publicUrl = null;

    if (paymentFile) {
       const fileExt = paymentFile.name.split('.').pop();
       const fileName = `receipt-${payingCostId}-${selectedMonth}-${Date.now()}.${fileExt}`;
       const filePath = `fixed_costs/${fileName}`;

       const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, paymentFile);
       if (uploadError) {
         alert("Upload failed: " + uploadError.message);
         setUploadingPayment(false);
         return;
       }
       const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
       publicUrl = data.publicUrl;
    }

    const { error: dbError } = await supabase.from('fixed_cost_payments').insert([{
      fixed_cost_id: payingCostId,
      month_year: selectedMonth,
      amount_paid: parseFloat(paymentAmount),
      receipt_url: publicUrl,
      payment_date: paymentDate
    }]);

    if (!dbError) {
      setShowPaymentModal(false);
      setPayingCostId(null);
      setPaymentAmount('');
      setPaymentFile(null);
      fetchFinancialData();
    } else {
      alert("Error saving payment: " + dbError.message);
    }
    setUploadingPayment(false);
  }

  async function handleDeleteFixedCostSuccess() {
    setShowPinModal(false);
    if (!costToDelete) return;
    const { error } = await supabase.from('fixed_costs').delete().eq('id', costToDelete);
    if (!error) fetchFinancialData();
    else alert("Error deleting: " + error.message);
    setCostToDelete(null);
  }

  // --- CHARTS ---
  const chartDataMap = new Map();
  loadsWithProfitability.forEach(load => {
    if (!load.delivery_date) return;
    if (!chartDataMap.has(load.delivery_date)) {
      chartDataMap.set(load.delivery_date, { date: load.delivery_date, gross: 0, net: 0, opex: 0 });
    }
    const day = chartDataMap.get(load.delivery_date);
    day.gross += load.profitability.rate;
    day.net += load.profitability.loadGrossMargin;
    day.opex += load.profitability.totalLoadOpex;
  });
  const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // --- DISPATCHER STATS ---
  const dispatcherStatsMap = new Map();
  loadsWithProfitability.forEach(load => {
    if (!load.dispatcher_id) return;
    const dispName = load.dispatcher ? `${load.dispatcher.first_name} ${load.dispatcher.last_name}` : 'Unknown';
    if (!dispatcherStatsMap.has(load.dispatcher_id)) {
      dispatcherStatsMap.set(load.dispatcher_id, { 
        id: load.dispatcher_id, 
        name: dispName, 
        totalGross: 0, 
        totalCommission: 0, 
        loadsCount: 0,
        companyName: load.dispatcher?.company_name || 'Independent',
        paymentInfo: load.dispatcher?.payment_info || '',
        commissionRate: load.dispatcher?.commission_rate || 5,
        idNumber: load.dispatcher?.dispatcher_id_number || ''
      });
    }
    const stat = dispatcherStatsMap.get(load.dispatcher_id);
    stat.totalGross += load.profitability.rate;
    stat.totalCommission += load.profitability.dispatchFee;
    stat.loadsCount += 1;
  });
  const dispatcherStats = Array.from(dispatcherStatsMap.values()).sort((a, b) => b.totalGross - a.totalGross);

  // --- UI COMPONENTS ---
  const filterLabels = {
    'week': 'Last 7 Days',
    'biweek': 'Last 14 Days',
    'month': 'Last 30 Days',
    'ytd': 'Year to Date',
    'all': 'All Time'
  };

  const handleExportExcel = () => {
    const dataToExport = loadsWithProfitability.map(load => ({
      'Load Number': load.load_number,
      'Delivery Date': load.delivery_date,
      'Gross Revenue': load.profitability.rate,
      'Dispatch Fee': load.profitability.dispatchFee,
      'Driver Pay': load.profitability.driverPay,
      'Employer Taxes': load.profitability.driverTaxes,
      'Factoring Fee': load.profitability.factoringFee,
      'Fuel Cost': load.profitability.loadFuel,
      'Additional Expenses': load.profitability.additionalExpenses,
      'Total Load OPEX': load.profitability.totalLoadOpex,
      'Load Gross Margin': load.profitability.loadGrossMargin
    }));
    exportToExcel(dataToExport, `financials_export_${timeFilter}`);
  };

  const isProfitable = trueNetProfit >= 0;

  return (
    <div className="h-full flex flex-col gap-6 relative overflow-y-auto hide-scrollbar">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financials & True P&L</h1>
          <p className="text-gray-400 mt-1">Real-time profitability, expenses, and net income</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 flex items-center transition"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </button>
          
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
        </div>
      </header>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-5 gap-4">
        <div className="glass-panel p-5 flex flex-col group">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Gross Revenue</div>
          <div className="text-2xl font-black text-white">${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
            <span>{filteredLoads.length} loads delivered</span>
            <span className="font-bold text-success">RPM: ${totalMiles > 0 ? (totalGross / totalMiles).toFixed(2) : '0.00'}/mi</span>
          </div>
        </div>
        <div className="glass-panel p-5 flex flex-col group">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Load OPEX (COGS)</div>
          <div className="text-2xl font-black text-warning">-${totalLoadOpex.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
            <span>{totalMiles.toLocaleString()} total miles</span>
            <span className="font-bold text-warning">CPM: ${totalMiles > 0 ? (totalLoadOpex / totalMiles).toFixed(2) : '0.00'}/mi</span>
          </div>
        </div>
        <div className="glass-panel p-5 flex flex-col group">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Repairs & Maint.</div>
          <div className="text-2xl font-black text-danger">-${totalRepairs.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div className="text-[10px] text-gray-500 mt-1">{filteredShopVisits.length} shop visits in period</div>
        </div>
        <div className="glass-panel p-5 flex flex-col group">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Prorated Fixed Costs</div>
          <div className="text-2xl font-black text-blue-400">-${proratedFixedCosts.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div className="text-[10px] text-gray-500 mt-1">${totalMonthlyFixed.toLocaleString()}/mo total</div>
        </div>
        <div className={`glass-panel p-5 flex flex-col border-b-4 ${isProfitable ? 'border-success' : 'border-danger'}`}>
          <div className="text-white text-xs font-bold uppercase mb-1">True Net Income</div>
          <div className={`text-3xl font-black ${isProfitable ? 'text-success' : 'text-danger'}`}>
            ${trueNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </div>
          {totalGross > 0 && (
            <div className={`text-[10px] font-bold mt-1 flex justify-between ${isProfitable ? 'text-success/70' : 'text-danger/70'}`}>
              <span>{((trueNetProfit / totalGross) * 100).toFixed(1)}% MARGIN</span>
              <span>TRUE CPM: ${totalMiles > 0 ? ((totalLoadOpex + totalRepairs + proratedFixedCosts) / totalMiles).toFixed(2) : '0.00'}/mi</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 pb-10">
        {/* Left Column: Summary & Fixed Costs */}
        <div className="w-[40%] space-y-6 flex flex-col min-h-0">
          <div className="glass-panel p-6 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center">
                {activeTab === 'summary' ? <PieChart className="w-5 h-5 mr-2 text-primary"/> : 
                 activeTab === 'fixed' ? <Receipt className="w-5 h-5 mr-2 text-blue-400"/> :
                 <BarChart2 className="w-5 h-5 mr-2 text-warning"/>}
                P&L Breakdown
              </h2>
              <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => setActiveTab('summary')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${activeTab === 'summary' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                >Summary</button>
                <button 
                  onClick={() => setActiveTab('fixed')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${activeTab === 'fixed' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                >Fixed Costs</button>
                <button 
                  onClick={() => setActiveTab('opex')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${activeTab === 'opex' ? 'bg-warning text-white' : 'text-gray-500 hover:text-white'}`}
                >Charts</button>
              </div>
            </div>

            {activeTab === 'summary' && (
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 hide-scrollbar min-h-0">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-white/10 pb-2">Revenue</h3>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-300">Gross Freight Revenue</span>
                    <span className="font-mono text-success font-bold">${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-white/10 pb-2">Cost of Goods Sold (OPEX)</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Driver Payroll & Taxes</span>
                    <span className="font-mono text-warning">-${(totalDriverPay + totalEmployerTaxes).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Fuel Costs</span>
                    <span className="font-mono text-warning">-${totalFuel.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Factoring Fees (2.5% + $5)</span>
                    <span className="font-mono text-warning">-${totalFactoring.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Dispatch Fees (5%)</span>
                    <span className="font-mono text-warning">-${totalDispatch.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="font-bold text-gray-300">Gross Margin</span>
                    <span className="font-mono text-white font-bold">${grossMargin.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-white/10 pb-2">Expenses</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 flex items-center"><Wrench className="w-3 h-3 mr-2"/> Repairs & Maintenance</span>
                    <span className="font-mono text-danger">-${totalRepairs.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 flex items-center"><Receipt className="w-3 h-3 mr-2"/> Fixed Costs (Prorated)</span>
                    <span className="font-mono text-blue-400">-${proratedFixedCosts.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <div className={`rounded-xl p-5 border ${isProfitable ? 'bg-success/10 border-success/30' : 'bg-danger/10 border-danger/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold uppercase tracking-wider">True Net Income</span>
                    <span className={`font-mono text-2xl font-black ${isProfitable ? 'text-success' : 'text-danger'}`}>
                      ${trueNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fixed' && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                   <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex-1 mr-4">
                     <p className="text-xs text-blue-300">
                       These are your <b>Monthly Fixed Costs</b>. They are automatically prorated in the P&L based on your active time filter, but you can track actual payments below.
                     </p>
                   </div>
                   <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-black/50 border border-white/20 rounded-xl p-3 text-white focus:border-primary outline-none" />
                </div>
                
                <div className="flex-1 overflow-auto hide-scrollbar space-y-3">
                  {fixedCosts.map(fc => {
                    const payment = fixedCostPayments.find(p => p.fixed_cost_id === fc.id);
                    const isPaid = !!payment;
                    const dueDay = fc.due_day || 1;
                    const isOverdue = !isPaid && (new Date().getDate() > dueDay) && (selectedMonth === new Date().toISOString().slice(0, 7));
                    const isDueSoon = !isPaid && !isOverdue && (dueDay - new Date().getDate() <= 3) && (dueDay - new Date().getDate() >= 0) && (selectedMonth === new Date().toISOString().slice(0, 7));

                    let expirationAlert = null;
                    if (fc.expiration_date) {
                      const expDate = new Date(fc.expiration_date);
                      const today = new Date();
                      const daysUntilExp = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysUntilExp <= 0) {
                        expirationAlert = <div className="text-danger text-xs font-bold mt-1 bg-danger/10 border border-danger/20 rounded p-1 inline-block">POLICY EXPIRED</div>;
                      } else if (daysUntilExp <= 30) {
                        expirationAlert = <div className="text-warning text-xs font-bold mt-1 bg-warning/10 border border-warning/20 rounded p-1 inline-block">Expires in {daysUntilExp} days</div>;
                      }
                    }

                    return (
                    <div key={fc.id} className={`flex flex-col p-4 bg-white/5 border ${isPaid ? 'border-success/30' : isOverdue ? 'border-danger/50' : isDueSoon ? 'border-warning/50' : 'border-white/10'} rounded-xl transition`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold flex items-center gap-2">
                             {fc.name}
                             {isPaid ? <span className="bg-success/20 text-success text-[10px] px-2 py-0.5 rounded uppercase font-bold">Paid</span> : 
                              isOverdue ? <span className="bg-danger/20 text-danger text-[10px] px-2 py-0.5 rounded uppercase font-bold">Overdue</span> :
                              isDueSoon ? <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded uppercase font-bold">Due Soon</span> :
                              <span className="bg-white/10 text-gray-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Unpaid</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{fc.provider || 'No provider'} • Due on day {dueDay}</div>
                          {expirationAlert}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-blue-400 font-bold mr-2">${Number(fc.monthly_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}/mo</div>
                          <button onClick={() => {
                            setEditingCostId(fc.id);
                            setEditFcName(fc.name);
                            setEditFcProvider(fc.provider || '');
                            setEditFcAmount(fc.monthly_amount.toString());
                            setEditFcDueDay(fc.due_day?.toString() || '1');
                            setEditFcExpirationDate(fc.expiration_date || '');
                          }} className="text-gray-500 hover:text-white transition p-1" title="Edit Fixed Cost">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setCostToDelete(fc.id); setShowPinModal(true); }} className="text-gray-500 hover:text-red-500 transition p-1" title="Delete Fixed Cost">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Payment Action Row */}
                      <div className="bg-black/30 rounded-lg p-3 flex justify-between items-center border border-white/5">
                        {isPaid ? (
                           <>
                             <div className="text-xs text-gray-400">Paid: <span className="text-white font-bold">${Number(payment.amount_paid).toLocaleString()}</span> on {new Date(payment.payment_date).toLocaleDateString()}</div>
                             {payment.receipt_url && <a href={payment.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg font-bold">View Receipt</a>}
                           </>
                        ) : (
                           <>
                             <div className="text-xs text-gray-500">No payment recorded for {selectedMonth}</div>
                             <button onClick={() => { setPayingCostId(fc.id); setPaymentAmount(fc.monthly_amount.toString()); setShowPaymentModal(true); }} className="text-xs bg-white text-black hover:bg-gray-200 px-3 py-1.5 rounded-lg font-bold transition">
                               Pay & Upload
                             </button>
                           </>
                        )}
                      </div>
                    </div>
                  )})}
                  {fixedCosts.length === 0 && (
                    <div className="text-center py-10 text-gray-500">No fixed costs configured.</div>
                  )}
                </div>

                {showAddFixedCost ? (
                  <div className="mt-4 p-4 border border-white/20 rounded-xl bg-black/50 space-y-3">
                    <h3 className="font-bold text-sm">Add Fixed Cost</h3>
                    <input type="text" value={fcName} onChange={e=>setFcName(e.target.value)} placeholder="Expense Name (e.g. Insurance)" className="w-full bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"/>
                    <input type="text" value={fcProvider} onChange={e=>setFcProvider(e.target.value)} placeholder="Provider (e.g. Progressive)" className="w-full bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"/>
                    <div className="flex gap-2">
                       <input type="number" value={fcAmount} onChange={e=>setFcAmount(e.target.value)} placeholder="Monthly Amount ($)" className="w-1/3 bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"/>
                       <input type="number" value={fcDueDay} onChange={e=>setFcDueDay(e.target.value)} placeholder="Due Day (1-31)" min="1" max="31" className="w-1/3 bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none" title="Day of month payment is due"/>
                       <input type="date" value={fcExpirationDate} onChange={e=>setFcExpirationDate(e.target.value)} className="w-1/3 bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none text-gray-400" title="Policy Expiration Date (Optional)"/>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleAddFixedCost} className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded text-sm transition">Save</button>
                      <button onClick={() => setShowAddFixedCost(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded text-sm transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddFixedCost(true)} className="mt-4 w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/50 transition flex justify-center items-center font-bold text-sm">
                    <Plus className="w-4 h-4 mr-2" /> Add Fixed Cost
                  </button>
                )}
              </div>
            )}

            {activeTab === 'opex' && (
               <div className="flex-1 flex flex-col min-h-[300px]">
                 <h3 className="text-sm font-bold text-gray-400 mb-4 text-center">Revenue vs Load OPEX (Daily)</h3>
                 {chartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                       <XAxis dataKey="date" stroke="#ffffff50" fontSize={10} tickFormatter={(t) => t.substring(5)} />
                       <YAxis stroke="#ffffff50" fontSize={10} tickFormatter={(t) => `$${t/1000}k`} />
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#111', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '12px' }}
                         itemStyle={{ fontWeight: 'bold' }}
                         formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                       />
                       <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                       <Bar dataKey="gross" name="Gross" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                       <Bar dataKey="opex" name="Load OPEX" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                       <Bar dataKey="net" name="Gross Margin" fill="#22c55e" radius={[2, 2, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                     No data for this period
                   </div>
                 )}
               </div>
            )}
          </div>

          {/* Dispatcher Leaderboard */}
          {activeTab === 'summary' && !loading && dispatcherStats.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-primary" />
                Dispatcher Performance
              </h3>
              <div className="space-y-3">
                {dispatcherStats.map((stat, idx) => (
                  <div key={stat.id} className="bg-black/40 border border-white/5 hover:border-primary/30 transition rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex items-start sm:items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 shrink-0 ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-gray-300/20 text-gray-300' : 'bg-primary/20 text-primary'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center flex-wrap gap-2">
                           {stat.name}
                           {stat.idNumber && <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{stat.idNumber}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{stat.companyName} • {stat.loadsCount} {stat.loadsCount === 1 ? 'Load' : 'Loads'}</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end sm:text-right ml-11 sm:ml-0 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                      <div className="flex items-center sm:justify-end gap-3 mb-1">
                         <div className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">{stat.commissionRate}% Fee</div>
                         <div className="text-sm font-black text-success">${stat.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-[10px] text-gray-500 font-normal uppercase">Gross</span></div>
                      </div>
                      <div className="flex items-center sm:justify-end gap-3">
                         <div className="text-[10px] text-gray-500 max-w-[150px] truncate" title={stat.paymentInfo}>{stat.paymentInfo || 'No payment info'}</div>
                         <div className="text-sm text-warning font-bold">${stat.totalCommission.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-[10px] text-gray-500 font-normal uppercase">Payout</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Load Details */}
        <div className="flex-1">
          <div className="glass-panel p-6 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
              <span className="flex items-center"><Activity className="w-5 h-5 mr-2 text-success"/> Load Reconciliation</span>
              <span className="text-sm font-normal text-gray-400 bg-white/5 px-3 py-1 rounded-full">{filteredLoads.length} Loads</span>
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
                           </div>
                           <div className="text-sm text-gray-400 mt-1">{load.pickup_location} &rarr; {load.delivery_location}</div>
                           <div className="text-xs text-gray-500 mt-1">Delivered: {load.delivery_date}</div>
                         </div>
                         <div className="text-right">
                           <div className="text-xs text-gray-500 uppercase font-bold mb-1">Gross</div>
                           <div className="text-2xl font-bold text-success">${load.profitability.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Payroll + Taxes</div>
                             <div className="font-mono text-warning font-semibold">
                               -${(load.profitability.driverPay + load.profitability.driverTaxes).toFixed(2)}
                             </div>
                          </div>
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Fuel Costs</div>
                             <div className="font-mono text-warning font-semibold">
                               -${load.profitability.loadFuel.toFixed(2)}
                             </div>
                          </div>
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Unforeseen/Tolls</div>
                             <div className="font-mono text-warning font-semibold">
                               -${load.profitability.additionalExpenses.toFixed(2)}
                             </div>
                          </div>
                          <div>
                             <div className="text-xs text-gray-500 mb-1">Factoring/Disp</div>
                             <div className="font-mono text-warning font-semibold">
                               -${(load.profitability.factoringFee + load.profitability.dispatchFee).toFixed(2)}
                             </div>
                          </div>
                          <div className="bg-success/10 rounded-lg p-2 border border-success/20 text-center flex flex-col justify-center col-span-4 sm:col-span-1 mt-2 sm:mt-0">
                             <div className="text-[10px] text-success uppercase font-bold mb-0.5">Gross Margin</div>
                             <div className="font-black text-success text-base">${load.profitability.loadGrossMargin.toFixed(2)}</div>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <PinModal 
        isOpen={showPinModal} 
        onClose={() => setShowPinModal(false)} 
        onSuccess={handleDeleteFixedCostSuccess}
        actionText="delete this fixed cost"
      />

      {showPaymentModal && payingCostId && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-2">Record Payment</h2>
            <p className="text-gray-400 text-sm mb-6">Mark this fixed cost as paid for {selectedMonth}.</p>
            
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-gray-400 block mb-1">Amount Paid ($)</label>
                  <input type="number" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none font-bold text-lg"/>
               </div>
               <div>
                  <label className="text-xs text-gray-400 block mb-1">Date of Payment</label>
                  <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none"/>
               </div>
               <div>
                 <label className="text-xs text-gray-400 block mb-1">Upload Receipt (PDF/Image)</label>
                 <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:bg-white/5 transition cursor-pointer">
                   <input type="file" onChange={e => setPaymentFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
                 </div>
               </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowPaymentModal(false)} className="px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition">Cancel</button>
              <button onClick={handleMarkPaid} disabled={uploadingPayment} className="px-8 py-3 rounded-xl font-bold bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/30 transition disabled:opacity-50">
                {uploadingPayment ? 'Saving...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCostId && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <h2 className="text-2xl font-bold mb-2">Edit Fixed Cost</h2>
            <input type="text" value={editFcName} onChange={e=>setEditFcName(e.target.value)} placeholder="Expense Name (e.g. Insurance)" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary outline-none"/>
            <input type="text" value={editFcProvider} onChange={e=>setEditFcProvider(e.target.value)} placeholder="Provider" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary outline-none"/>
            <div className="flex gap-2">
               <input type="number" value={editFcAmount} onChange={e=>setEditFcAmount(e.target.value)} placeholder="Monthly Amount ($)" className="w-1/3 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary outline-none"/>
               <input type="number" value={editFcDueDay} onChange={e=>setEditFcDueDay(e.target.value)} placeholder="Due Day (1-31)" min="1" max="31" className="w-1/3 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary outline-none" title="Day of month payment is due"/>
               <input type="date" value={editFcExpirationDate} onChange={e=>setEditFcExpirationDate(e.target.value)} className="w-1/3 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary outline-none text-gray-400" title="Policy Expiration Date (Optional)"/>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingCostId(null)} className="px-6 py-2 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition">Cancel</button>
              <button onClick={handleUpdateFixedCost} className="px-6 py-2 rounded-xl font-bold bg-primary hover:bg-blue-600 text-white shadow-lg transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
