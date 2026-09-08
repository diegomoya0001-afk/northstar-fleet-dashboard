"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PinModal from '@/components/PinModal';
import { Wallet, Search, CheckCircle, Clock, Calendar, Download, AlertCircle, FileText, MoreVertical, Trash2, Edit2, X, Printer, Plus } from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'drivers' | 'dispatchers' | 'deductions'>('drivers');
  
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dispatchers, setDispatchers] = useState<any[]>([]);
  const [unpaidDispatcherLoads, setUnpaidDispatcherLoads] = useState<any[]>([]);
  const [dispatcherSettlementsList, setDispatcherSettlementsList] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [unsettledLoadFinancials, setUnsettledLoadFinancials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);

  // PIN & Edit States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<'delete' | 'edit'>('delete');
  const [pinTargetType, setPinTargetType] = useState<'settlement' | 'deduction'>('settlement');
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | null>(null);
  const [editingSettlement, setEditingSettlement] = useState<any | null>(null);
  const [editGross, setEditGross] = useState('');
  const [editDeductions, setEditDeductions] = useState('');
  
  const [editingDeduction, setEditingDeduction] = useState<any | null>(null);
  const [editDedDesc, setEditDedDesc] = useState('');
  const [editDedAmount, setEditDedAmount] = useState('');
  const [editDedType, setEditDedType] = useState('');

  // Paystub UI
  const [viewingPaystub, setViewingPaystub] = useState<any | null>(null);
  const [paystubLoads, setPaystubLoads] = useState<any[]>([]);

  // Dispatcher Paystub UI
  const [viewingDispatcherPaystub, setViewingDispatcherPaystub] = useState<any | null>(null);
  const [dispatcherPaystubLoads, setDispatcherPaystubLoads] = useState<any[]>([]);

  // Driver Settlement Selection UI
  const [driverSettlementModal, setDriverSettlementModal] = useState<any | null>(null);
  const [selectedDriverLfIds, setSelectedDriverLfIds] = useState<string[]>([]);

  // Dispatcher Settlement Selection UI
  const [dispatcherSettlementModal, setDispatcherSettlementModal] = useState<any | null>(null);
  const [selectedDispatcherLoadIds, setSelectedDispatcherLoadIds] = useState<string[]>([]);

  // Deductions Form
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionDriver, setDeductionDriver] = useState('');
  const [deductionDesc, setDeductionDesc] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionType, setDeductionType] = useState('one-time');

  const renderRouting = (load: any) => {
    if (load?.stops && load.stops.length > 0) {
      const originStop = load.stops.find((s:any) => s.type === 'pickup') || load.stops[0];
      const destStop = [...load.stops].reverse().find((s:any) => s.type === 'delivery') || load.stops[load.stops.length - 1];
      const origin = originStop.location || originStop.address || 'Unknown Origin';
      const dest = destStop.location || destStop.address || 'Unknown Destination';
      return <>{origin} &rarr; {dest}</>;
    }
    const origin = load?.pickup_location || load?.pickup_address || 'Unknown Origin';
    const dest = load?.delivery_location || load?.delivery_address || 'Unknown Destination';
    if (origin === 'Unknown Origin' && dest === 'Unknown Destination') return <>N/A</>;
    return <>{origin} &rarr; {dest}</>;
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    const { data: driversData } = await supabase.from('users').select('*').eq('role', 'driver');
    if (driversData) setDrivers(driversData);

    const { data: dispatchersData } = await supabase.from('users').select('*').eq('role', 'dispatcher');
    if (dispatchersData) setDispatchers(dispatchersData);

    const { data: unpaidLoads } = await supabase
      .from('loads')
      .select('*, dispatcher:users!dispatcher_id(commission_rate)')
      .not('dispatcher_id', 'is', null)
      .eq('dispatcher_paid', false)
      .in('status', ['delivered', 'invoiced', 'paid']);
    if (unpaidLoads) setUnpaidDispatcherLoads(unpaidLoads);

    const { data: dSettlementsData } = await supabase
      .from('dispatcher_settlements')
      .select('*, users(first_name, last_name)')
      .order('created_at', { ascending: false });
    if (dSettlementsData) setDispatcherSettlementsList(dSettlementsData);

    const { data: settlementsData } = await supabase
      .from('driver_settlements')
      .select('*, users(first_name, last_name)')
      .order('created_at', { ascending: false });
    if (settlementsData) setSettlements(settlementsData);

    const { data: dedData } = await supabase
      .from('driver_deductions')
      .select('*, users(first_name, last_name)')
      .order('created_at', { ascending: false });
    if (dedData) setDeductions(dedData);

    const { data: lfData } = await supabase
       .from('load_financials')
       .select('*, loads(*)')
       .eq('status', 'reconciled');
    if (lfData) setUnsettledLoadFinancials(lfData);

    setLoading(false);
  }

  const handleOpenDriverModal = async (stat: any) => {
    // 1. Fetch un-settled load_financials
    const { data: lfData, error: lfError } = await supabase
       .from('load_financials')
       .select('*, loads!inner(*)')
       .eq('status', 'reconciled')
       .eq('loads.assigned_driver_id', stat.id);

    if (lfError || !lfData || lfData.length === 0) {
       alert("No newly reconciled loads found for this driver to generate a settlement.");
       return;
    }
    
    setDriverSettlementModal({ ...stat, loadFinancials: lfData });
    setSelectedDriverLfIds(lfData.map((lf: any) => lf.id));
  };

  const handleConfirmDriverSettlement = async () => {
    if (!driverSettlementModal || selectedDriverLfIds.length === 0 || generating) return;
    setGenerating(true);

    const selectedLfs = driverSettlementModal.loadFinancials.filter((lf: any) => selectedDriverLfIds.includes(lf.id));

    // 2. Fetch Active Deductions
    const { data: activeDeds } = await supabase
       .from('driver_deductions')
       .select('*')
       .eq('driver_id', driverSettlementModal.id)
       .eq('status', 'active');

    const totalDeds = activeDeds ? activeDeds.reduce((acc, d) => acc + Number(d.amount), 0) : 0;

    const now = new Date();
    const periodEnd = now.toISOString().split('T')[0];
    const periodStart = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
    
    const grossPay = selectedLfs.reduce((acc: number, row: any) => acc + Number(row.driver_pay || 0), 0);
    const taxes = grossPay * 0.0765; // Employer W2 Tax
    const netPayout = grossPay - totalDeds;

    // 3. Create Settlement
    const { data, error } = await supabase.from('driver_settlements').insert([{
      driver_id: driverSettlementModal.id,
      period_start: periodStart,
      period_end: periodEnd,
      total_gross_pay: grossPay,
      total_employer_taxes: taxes,
      deductions: totalDeds,
      net_payout: netPayout,
      status: 'pending'
    }]).select('*, users(first_name, last_name, phone)');

    if (error) {
      alert("Error generating settlement: " + error.message);
      setGenerating(false);
    } else if (data) {
      const settlementId = data[0].id;
      
      // Update loads to link them
      await supabase.from('load_financials').update({ status: 'settled', settlement_id: settlementId }).in('id', selectedDriverLfIds);

      // Mark one-time deductions as applied
      if (activeDeds) {
        const oneTimeIds = activeDeds.filter(d => d.type === 'one-time').map(d => d.id);
        if (oneTimeIds.length > 0) {
          await supabase.from('driver_deductions').update({ status: 'applied' }).in('id', oneTimeIds);
        }
      }

      setSettlements(prev => [data[0], ...prev]);
      setDriverSettlementModal(null);
      alert("Settlement successfully generated!");
      fetchData();
      setGenerating(false);
    }
  };

  const handleOpenDispatcherModal = (stat: any) => {
     if (stat.unpaidLoads.length === 0) return;
     setDispatcherSettlementModal(stat);
     setSelectedDispatcherLoadIds(stat.unpaidLoads.map((l: any) => l.id));
  };

  const handleConfirmDispatcherSettlement = async () => {
    if (!dispatcherSettlementModal || selectedDispatcherLoadIds.length === 0 || generating) return;
    setGenerating(true);
    
    const selectedLoads = dispatcherSettlementModal.unpaidLoads.filter((l: any) => selectedDispatcherLoadIds.includes(l.id));
    
    const totalGross = selectedLoads.reduce((sum: number, l: any) => sum + (Number(l.rate) || 0), 0);
    const totalCommission = selectedLoads.reduce((sum: number, l: any) => {
      const rate = Number(l.rate) || 0;
      const fee = l.dispatcher?.commission_rate != null ? Number(l.dispatcher.commission_rate) : 5;
      return sum + (rate * (fee / 100));
    }, 0);

    const now = new Date();
    const periodEnd = now.toISOString().split('T')[0];
    const periodStart = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];

    const { data, error } = await supabase.from('dispatcher_settlements').insert([{
      dispatcher_id: dispatcherSettlementModal.id,
      period_start: periodStart,
      period_end: periodEnd,
      total_loads: selectedLoads.length,
      total_gross_revenue: totalGross,
      total_commission: totalCommission,
      status: 'paid',
      paid_at: new Date().toISOString()
    }]).select('*');

    if (!error && data) {
      const settlementId = data[0].id;
      await supabase
        .from('loads')
        .update({ dispatcher_paid: true, dispatcher_payment_date: new Date().toISOString(), dispatcher_settlement_id: settlementId })
        .in('id', selectedDispatcherLoadIds);

      setDispatcherSettlementModal(null);
      fetchData();
    } else {
      alert("Error generating dispatcher settlement: " + error?.message);
    }
  };

  const handleSaveDeduction = async () => {
    if (!deductionDriver || !deductionDesc || !deductionAmount) return alert("Fill all fields");
    const { error } = await supabase.from('driver_deductions').insert([{
      driver_id: deductionDriver,
      description: deductionDesc,
      amount: parseFloat(deductionAmount),
      type: deductionType,
      status: 'active'
    }]);
    if (!error) {
      setShowDeductionModal(false);
      setDeductionDesc(''); setDeductionAmount('');
      fetchData();
    } else {
      alert("Error: " + error.message);
    }
  };

  const viewPaystub = async (settlement: any) => {
    // Fetch loads for this settlement
    const { data } = await supabase.from('load_financials').select('*, loads(*)').eq('settlement_id', settlement.id);
    if (data) setPaystubLoads(data);
    setViewingPaystub(settlement);
  };

  const viewDispatcherPaystub = async (settlement: any) => {
    // Fetch loads for this dispatcher settlement
    const { data } = await supabase.from('loads').select('*').eq('dispatcher_settlement_id', settlement.id);
    if (data) setDispatcherPaystubLoads(data);
    setViewingDispatcherPaystub(settlement);
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from('driver_settlements').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    if (!error) fetchData();
  };

  function requestPinFor(action: 'delete' | 'edit', item: any, type: 'settlement' | 'deduction' = 'settlement') {
    setPinAction(action);
    setPinTargetType(type);
    if (type === 'settlement') {
       setSelectedSettlementId(item.id);
       if (action === 'edit') {
          setEditingSettlement(item);
          setEditGross(item.total_gross_pay?.toString() || '0');
          setEditDeductions(item.deductions?.toString() || '0');
       }
    } else {
       setSelectedDeductionId(item.id);
       if (action === 'edit') {
          setEditingDeduction(item);
          setEditDedDesc(item.description || '');
          setEditDedAmount(item.amount?.toString() || '0');
          setEditDedType(item.type || 'one-time');
       }
    }
    setShowPinModal(true);
  }

  async function handlePinSuccess() {
    setShowPinModal(false);
    if (pinAction === 'delete') {
      if (pinTargetType === 'settlement' && selectedSettlementId) {
         const { error } = await supabase.from('driver_settlements').delete().eq('id', selectedSettlementId);
         if (!error) fetchData();
         setSelectedSettlementId(null);
      } else if (pinTargetType === 'deduction' && selectedDeductionId) {
         const { error } = await supabase.from('driver_deductions').delete().eq('id', selectedDeductionId);
         if (!error) fetchData();
         setSelectedDeductionId(null);
      }
    }
  }

  async function handleSaveEdit() {
     if (!editingSettlement) return;
     const gross = parseFloat(editGross) || 0;
     const ded = parseFloat(editDeductions) || 0;
     const taxes = gross * 0.0765;
     const net = gross - ded;

     const { error } = await supabase.from('driver_settlements').update({
        total_gross_pay: gross,
        total_employer_taxes: taxes,
        deductions: ded,
        net_payout: net
     }).eq('id', editingSettlement.id);

     if (!error) {
        setEditingSettlement(null);
        fetchData();
     }
  }

  async function handleSaveDeductionEdit() {
     if (!editingDeduction) return;
     const { error } = await supabase.from('driver_deductions').update({
        description: editDedDesc,
        amount: parseFloat(editDedAmount) || 0,
        type: editDedType
     }).eq('id', editingDeduction.id);

     if (!error) {
        setEditingDeduction(null);
        fetchData();
     }
  }

  const dispatcherUnpaidStats = dispatchers.map(disp => {
    const loads = unpaidDispatcherLoads.filter(l => l.dispatcher_id === disp.id);
    const totalGross = loads.reduce((sum, l) => sum + (Number(l.rate) || 0), 0);
    const totalCommission = loads.reduce((sum, l) => {
      const rate = Number(l.rate) || 0;
      const fee = l.dispatcher?.commission_rate != null ? Number(l.dispatcher.commission_rate) : 5;
      return sum + (rate * (fee / 100));
    }, 0);
    return { ...disp, unpaidLoads: loads, totalGross, totalCommission };
  }).filter(stat => stat.unpaidLoads.length > 0);

  // Driver Unpaid Stats
  const driverUnpaidStats = drivers.map(driver => {
     const driverLfs = unsettledLoadFinancials.filter(lf => lf.loads?.assigned_driver_id === driver.id);
     const totalGross = driverLfs.reduce((sum, lf) => sum + (Number(lf.driver_pay) || 0), 0);
     const activeDriverDeds = deductions.filter(d => d.driver_id === driver.id && d.status === 'active');
     const totalDeds = activeDriverDeds.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
     const netPayout = totalGross - totalDeds;
     return { ...driver, pendingLoads: driverLfs.length, totalGross, totalDeds, netPayout: netPayout > 0 ? netPayout : 0 };
  }).filter(stat => stat.pendingLoads > 0 || stat.totalDeds > 0); // Include if they have deductions even if 0 loads

  // Summary Metrics
  const totalPendingDriverPayout = driverUnpaidStats.reduce((sum, s) => sum + s.netPayout, 0);
  const totalPendingDispatchPayout = dispatcherUnpaidStats.reduce((sum, s) => sum + s.totalCommission, 0);
  
  const totalPaidToDrivers = settlements.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.net_payout), 0);
  const totalPaidToDispatchers = dispatcherSettlementsList.reduce((sum, s) => sum + Number(s.total_commission), 0);
  const totalAllTimePaid = totalPaidToDrivers + totalPaidToDispatchers;

  const handleExportExcel = () => {
    let dataToExport: any[] = [];
    let fileName = 'payroll_export';

    if (activeTab === 'drivers') {
      dataToExport = settlements.map(s => ({
        'Driver': s.users ? `${s.users.first_name} ${s.users.last_name}` : '',
        'Period Start': s.period_start,
        'Period End': s.period_end,
        'Gross Pay': s.total_gross_pay,
        'Deductions': s.deductions,
        'Net Payout': s.net_payout,
        'Status': s.status,
        'Generated Date': new Date(s.created_at).toLocaleDateString()
      }));
      fileName = 'driver_settlements';
    } else if (activeTab === 'dispatchers') {
      dataToExport = dispatcherSettlementsList.map(s => ({
        'Dispatcher': s.users ? `${s.users.first_name} ${s.users.last_name}` : '',
        'Period Start': s.period_start,
        'Period End': s.period_end,
        'Gross Managed': s.total_gross_revenue,
        'Commission Paid': s.total_commission,
        'Paid Date': new Date(s.paid_at).toLocaleDateString()
      }));
      fileName = 'dispatcher_settlements';
    } else if (activeTab === 'deductions') {
      dataToExport = deductions.map(d => ({
        'Driver': d.users ? `${d.users.first_name} ${d.users.last_name}` : '',
        'Description': d.description,
        'Type': d.type,
        'Amount': d.amount,
        'Status': d.status
      }));
      fileName = 'active_deductions';
    }

    exportToExcel(dataToExport, fileName);
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
             <Wallet className="w-8 h-8 mr-3 text-success" />
             Payroll & Settlements
          </h1>
          <p className="text-gray-400 mt-1">Manage driver payouts, deductions, and dispatch commissions.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 w-64 focus:outline-none focus:border-success/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 font-bold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 flex items-center rounded-lg transition"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </button>
          <button onClick={() => setShowDeductionModal(true)} className="glass-button px-4 flex items-center text-danger hover:bg-danger/20 border-danger/30">
            <Plus className="w-4 h-4 mr-2"/> Add Deduction
          </button>
        </div>
      </header>

      {/* Module Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 print:hidden">
         <div className="bg-[#111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Pending Driver Payouts</div>
            <div className="text-2xl font-black text-white">${totalPendingDriverPayout.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
         </div>
         <div className="bg-[#111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Pending Dispatch Comm.</div>
            <div className="text-2xl font-black text-warning">${totalPendingDispatchPayout.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
         </div>
         <div className="bg-[#111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Paid (All Time)</div>
            <div className="text-2xl font-black text-white">${totalAllTimePaid.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-2 print:hidden">
        <button 
          onClick={() => setActiveTab('drivers')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase transition-colors relative ${activeTab === 'drivers' ? 'text-success' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Driver Settlements
          {activeTab === 'drivers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('dispatchers')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase transition-colors relative ${activeTab === 'dispatchers' ? 'text-success' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Dispatcher Commissions
          {activeTab === 'dispatchers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('deductions')}
          className={`px-6 py-3 font-bold text-sm tracking-wider uppercase transition-colors relative ${activeTab === 'deductions' ? 'text-danger' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Active Deductions
          {activeTab === 'deductions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-danger rounded-t-full"></div>}
        </button>
      </div>

      {activeTab === 'drivers' && (
      <div className="grid grid-cols-3 gap-6 h-full pb-10 print:hidden">
         <div className="col-span-1 glass-panel p-6 flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center">
               <Calendar className="w-5 h-5 mr-2 text-gray-400" />
               Generate Cutoff
            </h2>
            <p className="text-sm text-gray-500 mb-6">Select a driver to generate their settlement for the current period. Deductions will be applied automatically.</p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 hide-scrollbar">
               {driverUnpaidStats.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).map(stat => (
                  <div key={stat.id} className="bg-[#111] border border-white/10 rounded-xl p-4 hover:border-success/30 transition flex flex-col">
                     <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                        <div>
                           <div className="font-bold">{stat.first_name} {stat.last_name}</div>
                           <span className="text-[10px] font-bold uppercase bg-white/10 px-2 py-0.5 rounded tracking-wider text-gray-300">W2</span>
                        </div>
                        <div className="text-right">
                           <div className="text-lg font-black text-success">${stat.netPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                           <div className="text-xs text-gray-500">{stat.pendingLoads} Loads</div>
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-center mb-3">
                        <div className="text-xs text-gray-400">Gross: <span className="text-white">${stat.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        <div className="text-xs text-gray-400">Deds: <span className="text-danger">-${stat.totalDeds.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                     </div>

                     <button 
                        onClick={() => handleOpenDriverModal(stat)}
                        disabled={stat.pendingLoads === 0}
                        className="w-full py-2 bg-success/20 hover:bg-success text-success hover:text-white font-bold rounded-lg transition text-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Generate Settlement
                     </button>
                  </div>
               ))}
               
               {driverUnpaidStats.length === 0 && (
                  <div className="text-center text-gray-500 mt-10">No pending loads for drivers.</div>
               )}
            </div>
         </div>

         <div className="col-span-2 glass-panel p-6 flex flex-col">
            <h2 className="text-lg font-bold mb-6 flex items-center justify-between">
               <span className="flex items-center"><FileText className="w-5 h-5 mr-2 text-primary" /> Settlement History</span>
               <span className="text-xs font-normal text-gray-500 bg-white/5 px-3 py-1 rounded-full">{settlements.length} Records</span>
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 hide-scrollbar space-y-4">
               {loading ? (
                  <div className="flex justify-center items-center h-40"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
               ) : settlements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p>No settlements generated yet.</p></div>
               ) : (
                  settlements.map((s: any) => (
                     <div key={s.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 hover:bg-white/5 transition group">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                           <div>
                              <h3 className="font-bold text-lg">{s.users?.first_name} {s.users?.last_name}</h3>
                              <p className="text-sm text-gray-500">Period: {s.period_start} to {s.period_end}</p>
                           </div>
                           <div className="text-right">
                              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Net Payout</div>
                              <div className="text-2xl font-black text-success">${Number(s.net_payout).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                           </div>
                        </div>

                        <div className="flex justify-between items-center">
                           <div className="flex gap-6">
                              <div>
                                 <div className="text-xs text-gray-500 mb-1">Gross Pay</div>
                                 <div className="font-mono text-sm">${Number(s.total_gross_pay).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div>
                                 <div className="text-xs text-gray-500 mb-1">Deductions</div>
                                 <div className="font-mono text-sm text-danger">-${Number(s.deductions).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                           </div>

                           <div className="flex items-center gap-3">
                              {s.status === 'pending' ? (
                                 <button onClick={() => markAsPaid(s.id)} className="px-4 py-2 bg-success text-white font-bold text-sm rounded-lg hover:bg-green-600 transition shadow-lg shadow-success/20">
                                    Mark as Paid
                                 </button>
                              ) : (
                                 <span className="text-xs font-bold text-success bg-success/10 px-3 py-1 rounded-full flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Paid
                                 </span>
                              )}
                              
                              <button onClick={() => viewPaystub(s)} className="p-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition text-primary font-bold flex items-center" title="View Paystub">
                                 <Printer className="w-4 h-4 mr-2" /> Paystub
                              </button>
                              <button onClick={() => requestPinFor('edit', s)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition text-gray-400" title="Edit"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => requestPinFor('delete', s)} className="p-2 bg-danger/10 hover:bg-danger/20 rounded-lg transition text-danger" title="Delete"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </div>
                     </div>
                  ))
               )}
             </div>
          </div>
       </div>
       )}

       {activeTab === 'dispatchers' && (
       <div className="grid grid-cols-3 gap-6 h-full pb-10 print:hidden">
          <div className="col-span-1 glass-panel p-6 flex flex-col">
             <h2 className="text-lg font-bold mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-gray-400" />
                Unpaid Commissions
             </h2>
             <div className="flex-1 overflow-y-auto space-y-3 pr-2 hide-scrollbar">
                {dispatcherUnpaidStats.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).map(stat => (
                   <div key={stat.id} className="bg-[#111] border border-white/10 rounded-xl p-4 hover:border-success/30 transition">
                      <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                         <div>
                            <h3 className="font-bold">{stat.first_name} {stat.last_name}</h3>
                            <div className="text-xs text-gray-500">{stat.commission_rate}% Commission Rate</div>
                         </div>
                         <div className="text-right">
                            <div className="text-lg font-black text-warning">${stat.totalCommission.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div className="text-xs text-gray-500">{stat.unpaidLoads.length} Loads</div>
                         </div>
                      </div>
                      <button 
                         onClick={() => handleOpenDispatcherModal(stat)}
                         className="w-full py-2 bg-success/20 hover:bg-success text-success hover:text-white font-bold rounded-lg transition text-sm flex items-center justify-center"
                      >
                         <CheckCircle className="w-4 h-4 mr-2" />
                         Generate Settlement
                      </button>
                   </div>
                ))}
             </div>
          </div>

          <div className="col-span-2 glass-panel p-6 flex flex-col">
             <h2 className="text-lg font-bold mb-6 flex items-center justify-between">
                <span className="flex items-center"><FileText className="w-5 h-5 mr-2 text-warning" /> Settlement History</span>
             </h2>
             <div className="flex-1 overflow-y-auto pr-2 hide-scrollbar space-y-4">
                   {dispatcherSettlementsList.map((s: any) => (
                      <div key={s.id} className="bg-[#111] border border-white/10 rounded-2xl p-5">
                         <div className="flex justify-between items-center">
                            <div>
                               <h3 className="font-bold text-lg">{s.users?.first_name} {s.users?.last_name}</h3>
                               <p className="text-sm text-gray-500">Paid on: {new Date(s.paid_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-8 text-right">
                               <div>
                                  <div className="text-xs text-gray-500 uppercase font-bold mb-1">Gross Managed</div>
                                  <div className="text-lg font-mono">${Number(s.total_gross_revenue).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                               </div>
                               <div>
                                  <div className="text-xs text-success uppercase font-bold mb-1">Commission Paid</div>
                                  <div className="text-2xl font-black text-success">${Number(s.total_commission).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                               </div>
                            </div>
                            <div className="ml-6 flex items-center border-l border-white/10 pl-6">
                               <button onClick={() => viewDispatcherPaystub(s)} className="p-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition text-primary font-bold flex items-center" title="View Paystub">
                                  <Printer className="w-5 h-5" />
                               </button>
                            </div>
                         </div>
                      </div>
                   ))}
             </div>
          </div>
       </div>
       )}

       {activeTab === 'deductions' && (
         <div className="glass-panel p-6 h-full overflow-y-auto print:hidden">
            <h2 className="text-xl font-bold mb-6">Active Deductions & Advances</h2>
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-sm">
                     <th className="pb-4 font-medium pl-4">Driver</th>
                     <th className="pb-4 font-medium">Description</th>
                     <th className="pb-4 font-medium">Type</th>
                     <th className="pb-4 font-medium">Amount</th>
                     <th className="pb-4 font-medium">Status</th>
                  </tr>
               </thead>
               <tbody>
                  {deductions.filter(d => d.status === 'active').map(d => (
                     <tr key={d.id} className="border-b border-white/5">
                        <td className="py-4 pl-4 font-bold">{d.users?.first_name} {d.users?.last_name}</td>
                        <td className="py-4">{d.description}</td>
                        <td className="py-4 uppercase text-xs"><span className={`px-2 py-1 rounded bg-white/10`}>{d.type}</span></td>
                        <td className="py-4 font-mono text-danger">-${Number(d.amount).toFixed(2)}</td>
                        <td className="py-4 flex justify-between items-center pr-4">
                           <span className="text-success text-xs font-bold">Active</span>
                           <div>
                              <button onClick={() => requestPinFor('edit', d, 'deduction')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition text-gray-400 mr-2" title="Edit"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => requestPinFor('delete', d, 'deduction')} className="p-2 bg-danger/10 hover:bg-danger/20 rounded-lg transition text-danger" title="Delete"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
       )}

       {/* Paystub Modal / Print View */}
       {viewingPaystub && (
         <div className="fixed inset-0 bg-black/90 z-[200] flex justify-center overflow-y-auto p-4 print:p-0 print:bg-white print:text-black">
            <div className="bg-white text-black w-full max-w-3xl min-h-screen relative shadow-2xl p-10 print:p-0 print:shadow-none mx-auto">
               <button onClick={() => setViewingPaystub(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black print:hidden"><X className="w-6 h-6"/></button>
               <button onClick={() => window.print()} className="absolute top-4 right-16 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center print:hidden hover:bg-blue-700">
                  <Printer className="w-4 h-4 mr-2"/> Print PDF
               </button>

               <div className="flex justify-between items-end border-b-2 border-gray-200 pb-6 mb-6">
                  <div>
                     <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Northstar</h1>
                     <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Freight Logistics</p>
                  </div>
                  <div className="text-right">
                     <h2 className="text-2xl font-light text-gray-400 uppercase tracking-widest">Paystub</h2>
                     <p className="text-sm font-bold text-gray-800 mt-1">ID: #{viewingPaystub.id.substring(0,8).toUpperCase()}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-12 mb-10">
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Driver Information</h3>
                     <p className="font-bold text-gray-800">{viewingPaystub.users?.first_name} {viewingPaystub.users?.last_name}</p>
                     <p className="text-gray-600 text-sm">{viewingPaystub.users?.phone || 'Phone not on file'}</p>
                     <p className="text-gray-500 text-xs mt-2 uppercase">W2 Employee</p>
                  </div>
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Period Information</h3>
                     <table className="w-full text-sm">
                        <tbody>
                           <tr><td className="py-1 text-gray-500">Period Start:</td><td className="py-1 font-bold text-right">{new Date(viewingPaystub.period_start).toLocaleDateString()}</td></tr>
                           <tr><td className="py-1 text-gray-500">Period End:</td><td className="py-1 font-bold text-right">{new Date(viewingPaystub.period_end).toLocaleDateString()}</td></tr>
                           <tr><td className="py-1 text-gray-500">Pay Date:</td><td className="py-1 font-bold text-right">{new Date(viewingPaystub.created_at).toLocaleDateString()}</td></tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Earnings (Loads)</h3>
               <table className="w-full text-sm mb-10">
                  <thead>
                     <tr className="bg-gray-50 text-gray-500">
                        <th className="py-2 px-3 text-left font-bold">Load #</th>
                        <th className="py-2 px-3 text-left font-bold">Delivery Date</th>
                        <th className="py-2 px-3 text-left font-bold">Origin &rarr; Destination</th>
                        <th className="py-2 px-3 text-right font-bold">Amount</th>
                     </tr>
                  </thead>
                  <tbody>
                     {paystubLoads.map(lf => (
                        <tr key={lf.id} className="border-b border-gray-100">
                           <td className="py-3 px-3 font-mono">{lf.loads?.load_number}</td>
                           <td className="py-3 px-3">{new Date(lf.loads?.delivery_date).toLocaleDateString()}</td>
                           <td className="py-3 px-3">{renderRouting(lf.loads)}</td>
                           <td className="py-3 px-3 text-right font-bold">${Number(lf.driver_pay).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>

               <div className="grid grid-cols-2 gap-12">
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Deductions</h3>
                     {Number(viewingPaystub.deductions) > 0 ? (
                        <table className="w-full text-sm">
                           <tbody>
                              <tr className="border-b border-gray-100">
                                 <td className="py-2 text-gray-600">Standard / Applied Deductions</td>
                                 <td className="py-2 text-right text-red-600 font-bold">-${Number(viewingPaystub.deductions).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                              </tr>
                           </tbody>
                        </table>
                     ) : (
                        <p className="text-sm text-gray-400 italic">No deductions applied this period.</p>
                     )}
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                     <table className="w-full text-sm">
                        <tbody>
                           <tr>
                              <td className="py-2 text-gray-600 font-bold uppercase">Total Gross</td>
                              <td className="py-2 text-right font-bold">${Number(viewingPaystub.total_gross_pay).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                           <tr className="border-b border-gray-200">
                              <td className="py-2 text-gray-600 font-bold uppercase">Total Deductions</td>
                              <td className="py-2 text-right text-red-600 font-bold">-${Number(viewingPaystub.deductions).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                           <tr>
                              <td className="py-4 text-gray-900 font-black uppercase text-xl">Net Payout</td>
                              <td className="py-4 text-right text-green-600 font-black text-xl">${Number(viewingPaystub.net_payout).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="mt-16 text-center text-xs text-gray-400 pt-8 border-t border-gray-200">
                  Generated by Northstar Fleet OS
               </div>
            </div>
         </div>
       )}

       {/* Dispatcher Settlement Modal */}
       {dispatcherSettlementModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
             <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                   <div>
                      <h2 className="text-xl font-bold">Select Loads for Settlement</h2>
                      <p className="text-sm text-gray-500">{dispatcherSettlementModal.first_name} {dispatcherSettlementModal.last_name}</p>
                   </div>
                   <button onClick={() => setDispatcherSettlementModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-2 hide-scrollbar">
                   {dispatcherSettlementModal.unpaidLoads.map((load: any) => {
                      const isSelected = selectedDispatcherLoadIds.includes(load.id);
                      const rate = Number(load.rate) || 0;
                      const feeRate = load.dispatcher?.commission_rate != null ? Number(load.dispatcher.commission_rate) : 5;
                      const commission = rate * (feeRate / 100);
                      
                      return (
                         <div 
                           key={load.id} 
                           onClick={() => {
                              if (isSelected) {
                                 setSelectedDispatcherLoadIds(prev => prev.filter(id => id !== load.id));
                              } else {
                                 setSelectedDispatcherLoadIds(prev => [...prev, load.id]);
                              }
                           }}
                           className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${isSelected ? 'bg-success/10 border-success/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                         >
                            <div className="flex items-center">
                               <div className={`w-5 h-5 rounded border flex items-center justify-center mr-4 ${isSelected ? 'bg-success border-success text-white' : 'border-gray-500'}`}>
                                  {isSelected && <CheckCircle className="w-3 h-3" />}
                               </div>
                               <div>
                                  <div className="font-bold text-sm">Load #{load.load_number}</div>
                                  <div className="text-xs text-gray-400">{renderRouting(load)}</div>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-bold text-success">${commission.toFixed(2)}</div>
                               <div className="text-xs text-gray-500">Gross: ${rate.toFixed(2)}</div>
                            </div>
                         </div>
                      );
                   })}
                </div>
                
                <div className="border-t border-white/10 pt-4 mt-auto">
                   <div className="flex justify-between items-end mb-4">
                      <div>
                         <div className="text-xs text-gray-500 font-bold uppercase mb-1">Selected Loads</div>
                         <div className="text-xl font-bold">{selectedDispatcherLoadIds.length} of {dispatcherSettlementModal.unpaidLoads.length}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Commission to Pay</div>
                         <div className="text-3xl font-black text-success">
                            ${dispatcherSettlementModal.unpaidLoads
                                .filter((l:any) => selectedDispatcherLoadIds.includes(l.id))
                                .reduce((sum:number, l:any) => sum + ((Number(l.rate) || 0) * ((l.dispatcher?.commission_rate != null ? Number(l.dispatcher.commission_rate) : 5) / 100)), 0)
                                .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </div>
                      </div>
                   </div>
                   <button 
                      onClick={handleConfirmDispatcherSettlement}
                      disabled={selectedDispatcherLoadIds.length === 0 || generating}
                      className="w-full py-4 bg-success text-white font-bold rounded-xl hover:bg-green-600 transition shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      {generating ? 'Processing...' : 'Confirm & Generate Settlement'}
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* Driver Settlement Modal */}
       {driverSettlementModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
             <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                   <div>
                      <h2 className="text-xl font-bold">Select Loads for Driver Settlement</h2>
                      <p className="text-sm text-gray-500">{driverSettlementModal.first_name} {driverSettlementModal.last_name}</p>
                   </div>
                   <button onClick={() => setDriverSettlementModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-2 hide-scrollbar">
                   {driverSettlementModal.loadFinancials.map((lf: any) => {
                      const isSelected = selectedDriverLfIds.includes(lf.id);
                      const pay = Number(lf.driver_pay) || 0;
                      
                      return (
                         <div 
                           key={lf.id} 
                           onClick={() => {
                              if (isSelected) {
                                 setSelectedDriverLfIds(prev => prev.filter(id => id !== lf.id));
                              } else {
                                 setSelectedDriverLfIds(prev => [...prev, lf.id]);
                              }
                           }}
                           className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${isSelected ? 'bg-success/10 border-success/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                         >
                            <div className="flex items-center">
                               <div className={`w-5 h-5 rounded border flex items-center justify-center mr-4 ${isSelected ? 'bg-success border-success text-white' : 'border-gray-500'}`}>
                                  {isSelected && <CheckCircle className="w-3 h-3" />}
                               </div>
                               <div>
                                  <div className="font-bold text-sm">Load #{lf.loads?.load_number}</div>
                                  <div className="text-xs text-gray-400">{renderRouting(lf.loads)}</div>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-bold text-success">${pay.toFixed(2)}</div>
                            </div>
                         </div>
                      );
                   })}
                </div>
                
                <div className="border-t border-white/10 pt-4 mt-auto">
                   <div className="flex justify-between items-end mb-4">
                      <div>
                         <div className="text-xs text-gray-500 font-bold uppercase mb-1">Selected Loads</div>
                         <div className="text-xl font-bold">{selectedDriverLfIds.length} of {driverSettlementModal.loadFinancials.length}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Gross Pay (Before Deductions)</div>
                         <div className="text-3xl font-black text-success">
                            ${driverSettlementModal.loadFinancials
                                .filter((lf:any) => selectedDriverLfIds.includes(lf.id))
                                .reduce((sum:number, lf:any) => sum + (Number(lf.driver_pay) || 0), 0)
                                .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </div>
                      </div>
                   </div>
                   <button 
                      onClick={handleConfirmDriverSettlement}
                      disabled={selectedDriverLfIds.length === 0 || generating}
                      className="w-full py-4 bg-success text-white font-bold rounded-xl hover:bg-green-600 transition shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      {generating ? 'Generating...' : 'Confirm & Generate Settlement'}
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* Dispatcher Paystub Modal / Print View */}
       {viewingDispatcherPaystub && (
         <div className="fixed inset-0 bg-black/90 z-[200] flex justify-center overflow-y-auto p-4 print:p-0 print:bg-white print:text-black">
            <div className="bg-white text-black w-full max-w-3xl min-h-screen relative shadow-2xl p-10 print:p-0 print:shadow-none mx-auto">
               <button onClick={() => setViewingDispatcherPaystub(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black print:hidden"><X className="w-6 h-6"/></button>
               <button onClick={() => window.print()} className="absolute top-4 right-16 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center print:hidden hover:bg-blue-700">
                  <Printer className="w-4 h-4 mr-2"/> Print PDF
               </button>

               <div className="flex justify-between items-end border-b-2 border-gray-200 pb-6 mb-6">
                  <div>
                     <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Northstar</h1>
                     <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Freight Logistics</p>
                  </div>
                  <div className="text-right">
                     <h2 className="text-2xl font-light text-gray-400 uppercase tracking-widest">Commission Paystub</h2>
                     <p className="text-sm font-bold text-gray-800 mt-1">ID: #{viewingDispatcherPaystub.id.substring(0,8).toUpperCase()}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-12 mb-10">
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Dispatcher Information</h3>
                     <p className="font-bold text-lg text-gray-900">{viewingDispatcherPaystub.users?.first_name} {viewingDispatcherPaystub.users?.last_name}</p>
                     <p className="text-gray-500 text-xs mt-2 uppercase">Independent Dispatcher / Contractor</p>
                  </div>
                  <div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Period Information</h3>
                     <table className="w-full text-sm">
                        <tbody>
                           <tr><td className="py-1 text-gray-500">Period Start:</td><td className="py-1 font-bold text-right">{new Date(viewingDispatcherPaystub.period_start).toLocaleDateString()}</td></tr>
                           <tr><td className="py-1 text-gray-500">Period End:</td><td className="py-1 font-bold text-right">{new Date(viewingDispatcherPaystub.period_end).toLocaleDateString()}</td></tr>
                           <tr><td className="py-1 text-gray-500">Pay Date:</td><td className="py-1 font-bold text-right">{new Date(viewingDispatcherPaystub.paid_at).toLocaleDateString()}</td></tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Managed Loads</h3>
               <table className="w-full text-sm mb-10">
                  <thead>
                     <tr className="bg-gray-50 text-gray-500">
                        <th className="py-2 px-3 text-left font-bold">Load #</th>
                        <th className="py-2 px-3 text-left font-bold">Delivery Date</th>
                        <th className="py-2 px-3 text-left font-bold">Origin &rarr; Destination</th>
                        <th className="py-2 px-3 text-right font-bold">Gross Rate</th>
                     </tr>
                  </thead>
                  <tbody>
                     {dispatcherPaystubLoads.map(load => (
                        <tr key={load.id} className="border-b border-gray-100">
                           <td className="py-3 px-3 font-mono">{load.load_number}</td>
                           <td className="py-3 px-3">{load.delivery_date ? new Date(load.delivery_date).toLocaleDateString() : 'N/A'}</td>
                           <td className="py-3 px-3">{renderRouting(load)}</td>
                           <td className="py-3 px-3 text-right font-bold">${Number(load.rate).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>

               <div className="grid grid-cols-2 gap-12">
                  <div></div>
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                     <table className="w-full text-sm">
                        <tbody>
                           <tr>
                              <td className="py-2 text-gray-600 font-bold uppercase">Total Gross Managed</td>
                              <td className="py-2 text-right font-bold">${Number(viewingDispatcherPaystub.total_gross_revenue).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                           <tr>
                              <td className="py-4 text-gray-900 font-black uppercase text-xl">Total Commission</td>
                              <td className="py-4 text-right text-green-600 font-black text-xl">${Number(viewingDispatcherPaystub.total_commission).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="mt-16 text-center text-xs text-gray-400 pt-8 border-t border-gray-200">
                  Generated by Northstar Fleet OS
               </div>
            </div>
         </div>
       )}

       {showDeductionModal && (
         <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10 print:hidden">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Add Deduction / Advance</h2>
                  <button onClick={() => setShowDeductionModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
               </div>
               <div className="space-y-4">
                  <div>
                     <label className="text-xs text-gray-400 font-bold block mb-1">Driver</label>
                     <select value={deductionDriver} onChange={e => setDeductionDriver(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white">
                        <option value="">Select Driver...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs text-gray-400 font-bold block mb-1">Description (e.g. Cash Advance)</label>
                     <input type="text" value={deductionDesc} onChange={e => setDeductionDesc(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs text-gray-400 font-bold block mb-1">Amount ($)</label>
                        <input type="number" step="0.01" value={deductionAmount} onChange={e => setDeductionAmount(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white" />
                     </div>
                     <div>
                        <label className="text-xs text-gray-400 font-bold block mb-1">Type</label>
                        <select value={deductionType} onChange={e => setDeductionType(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white">
                           <option value="one-time">One-time</option>
                           <option value="recurring">Recurring</option>
                        </select>
                     </div>
                  </div>
                  <button onClick={handleSaveDeduction} className="w-full bg-danger text-white font-bold py-3 rounded-xl hover:bg-red-600 transition shadow-[0_0_20px_rgba(239,68,68,0.3)] mt-4">Save Deduction</button>
               </div>
            </div>
         </div>
       )}

       <PinModal isOpen={showPinModal} onClose={() => { setShowPinModal(false); if (pinAction === 'edit') { setEditingSettlement(null); setEditingDeduction(null); } }} onSuccess={handlePinSuccess} actionText={pinAction === 'delete' ? `delete this ${pinTargetType}` : `edit this ${pinTargetType}`} />

       {editingDeduction && !showPinModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
             <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                   <h2 className="text-xl font-bold">Edit Deduction</h2>
                   <button onClick={() => setEditingDeduction(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4 mb-6">
                   <div>
                      <label className="text-xs text-gray-400 font-bold block mb-1">Description</label>
                      <input type="text" value={editDedDesc} onChange={e => setEditDedDesc(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-xs text-gray-400 font-bold block mb-1">Amount ($)</label>
                         <input type="number" step="0.01" value={editDedAmount} onChange={e => setEditDedAmount(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                         <label className="text-xs text-gray-400 font-bold block mb-1">Type</label>
                         <select value={editDedType} onChange={e => setEditDedType(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary">
                            <option value="one-time">One-time</option>
                            <option value="recurring">Recurring</option>
                         </select>
                      </div>
                   </div>
                </div>
                <button onClick={handleSaveDeductionEdit} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition shadow-[0_0_20px_rgba(59,130,246,0.3)]">Save Changes</button>
             </div>
          </div>
       )}
    </div>
  );
}
