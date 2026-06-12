"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Droplet, MapPin, Calendar, FileText, Search, Truck, User, TrendingUp, X, Trash2, Edit2, Map } from 'lucide-react';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function AdminFuelLogs() {
  const [activeTab, setActiveTab] = useState<'logs' | 'ifta'>('logs');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptModal, setReceiptModal] = useState<string | null>(null);

  // Edit Modal States
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editOdometer, setEditOdometer] = useState('');
  const [editGallons, setEditGallons] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editState, setEditState] = useState('');

  // IFTA Filter States
  const [iftaYear, setIftaYear] = useState(new Date().getFullYear().toString());
  const [iftaQuarter, setIftaQuarter] = useState('Q1');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fuel_logs')
      .select(`
        *,
        driver:users!fuel_logs_driver_id_fkey(first_name, last_name),
        vehicle:vehicles!fuel_logs_vehicle_id_fkey(unit_number)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  }

  async function handleDelete(logId: string) {
    if (!confirm('Are you sure you want to delete this fuel record? This action cannot be undone.')) return;
    const { error } = await supabase.from('fuel_logs').delete().eq('id', logId);
    if (!error) {
      fetchLogs();
    } else {
      alert("Error deleting record: " + error.message);
    }
  }

  function openEditModal(log: any) {
    setEditingLog(log);
    setEditOdometer(log.odometer?.toString() || '');
    setEditGallons(log.gallons?.toString() || '');
    setEditPrice(log.price_per_gallon?.toString() || '');
    setEditTotal(log.total_cost?.toString() || '');
    setEditState(log.state || 'TX');
  }

  async function handleUpdateLog() {
    if (!editingLog) return;
    
    const { error } = await supabase.from('fuel_logs').update({
      odometer: parseFloat(editOdometer),
      gallons: parseFloat(editGallons),
      price_per_gallon: parseFloat(editPrice || "0"),
      total_cost: parseFloat(editTotal),
      state: editState
    }).eq('id', editingLog.id);

    if (!error) {
      setEditingLog(null);
      fetchLogs();
    } else {
      alert("Error updating record: " + error.message);
    }
  }

  // Calculate KPIs
  const totalCost = logs.reduce((acc, log) => acc + (Number(log.total_cost) || 0), 0);
  const totalGallons = logs.reduce((acc, log) => acc + (Number(log.gallons) || 0), 0);
  const averagePricePerGal = totalGallons > 0 ? (totalCost / totalGallons).toFixed(2) : '0.00';

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const searchStr = searchTerm.toLowerCase();
    const driverName = log.driver ? `${log.driver.first_name} ${log.driver.last_name}`.toLowerCase() : 'anonymous';
    const station = (log.gas_station || '').toLowerCase();
    const truck = (log.vehicle?.unit_number || '').toLowerCase();
    return driverName.includes(searchStr) || station.includes(searchStr) || truck.includes(searchStr);
  });

  // IFTA Grouping
  const getIftaData = () => {
    let qStartMonth = 0; let qEndMonth = 2;
    if (iftaQuarter === 'Q2') { qStartMonth = 3; qEndMonth = 5; }
    if (iftaQuarter === 'Q3') { qStartMonth = 6; qEndMonth = 8; }
    if (iftaQuarter === 'Q4') { qStartMonth = 9; qEndMonth = 11; }

    const iftaLogs = logs.filter(log => {
      const d = new Date(log.created_at);
      return d.getFullYear() === parseInt(iftaYear) && d.getMonth() >= qStartMonth && d.getMonth() <= qEndMonth;
    });

    const byState: Record<string, { gallons: number, cost: number }> = {};
    iftaLogs.forEach(log => {
      const state = log.state || 'Unknown';
      if (!byState[state]) byState[state] = { gallons: 0, cost: 0 };
      byState[state].gallons += Number(log.gallons || 0);
      byState[state].cost += Number(log.total_cost || 0);
    });

    return Object.entries(byState).sort((a,b) => b[1].gallons - a[1].gallons);
  };

  const iftaData = getIftaData();

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fuel Management</h1>
          <p className="text-gray-400 mt-1">Track fuel expenses, manage IFTA reports, and verify receipts</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm font-semibold mb-1">Total Fuel Expenses</div>
            <div className="text-3xl font-bold text-white">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-danger/20 text-danger flex items-center justify-center">
             <Droplet className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm font-semibold mb-1">Total Gallons Pumped</div>
            <div className="text-3xl font-bold text-white">{totalGallons.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-lg text-gray-500">gal</span></div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
             <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm font-semibold mb-1">Average Price / Gal</div>
            <div className="text-3xl font-bold text-success">${averagePricePerGal}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-success/20 text-success flex items-center justify-center">
             <DollarSignIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex space-x-2 bg-black/40 p-1 rounded-xl border border-white/10">
            <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'logs' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('logs')}>Fuel Logs</button>
            <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'ifta' ? 'bg-success text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('ifta')}>IFTA Reports</button>
          </div>

          {activeTab === 'logs' && (
            <div className="relative w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by driver, truck, or station..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#000] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto hide-scrollbar p-0">
          {activeTab === 'logs' ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#111] z-10 shadow-md">
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/10">
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Driver</th>
                  <th className="px-6 py-4 font-semibold">Truck</th>
                  <th className="px-6 py-4 font-semibold">Station & State</th>
                  <th className="px-6 py-4 font-semibold text-right">Gallons</th>
                  <th className="px-6 py-4 font-semibold text-right">Total Cost</th>
                  <th className="px-6 py-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      Loading logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No fuel records found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const date = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const time = log.refuel_time || new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const driverName = log.driver ? `${log.driver.first_name} ${log.driver.last_name}` : 'Anonymous User';
                    const truck = log.vehicle ? log.vehicle.unit_number : 'Unknown';
                    
                    return (
                      <tr key={log.id} className="hover:bg-white/5 transition group">
                        <td className="px-6 py-4">
                          <div className="font-bold">{date}</div>
                          <div className="text-xs text-gray-500 flex items-center mt-1"><Calendar className="w-3 h-3 mr-1" /> {time}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mr-3">
                              <User className="w-4 h-4" />
                            </div>
                            <span className="font-semibold">{driverName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-gray-300">
                            <Truck className="w-4 h-4 mr-2 text-primary" />
                            {truck}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Odo: {Number(log.odometer).toLocaleString()} mi</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" /> 
                            {log.gas_station}
                            {log.state && <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">{log.state}</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{log.fuel_type || 'Diesel'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold">{Number(log.gallons).toFixed(3)}</div>
                          <div className="text-xs text-gray-500 mt-1">${Number(log.price_per_gallon).toFixed(3)}/gal</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-black text-white">${Number(log.total_cost).toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {log.receipt_url && (
                              <button 
                                onClick={() => setReceiptModal(log.receipt_url)}
                                className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition inline-flex"
                                title="View Receipt"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openEditModal(log)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition inline-flex" title="Edit Record">
                               <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(log.id)} className="p-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl transition inline-flex" title="Delete Record">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
               <div className="flex items-center space-x-4 mb-6">
                 <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">Filing Year</label>
                    <select value={iftaYear} onChange={e => setIftaYear(e.target.value)} className="bg-[#111] border border-white/10 rounded-lg p-2 text-white outline-none">
                       {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">Quarter</label>
                    <select value={iftaQuarter} onChange={e => setIftaQuarter(e.target.value)} className="bg-[#111] border border-white/10 rounded-lg p-2 text-white outline-none">
                       <option value="Q1">Q1 (Jan - Mar)</option>
                       <option value="Q2">Q2 (Apr - Jun)</option>
                       <option value="Q3">Q3 (Jul - Sep)</option>
                       <option value="Q4">Q4 (Oct - Dec)</option>
                    </select>
                 </div>
               </div>

               {iftaData.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 bg-white/5 rounded-2xl border border-white/10">
                     <Map className="w-10 h-10 mx-auto mb-3 opacity-50" />
                     <p>No fuel purchases recorded for {iftaQuarter} {iftaYear}.</p>
                  </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {iftaData.map(([state, data]) => (
                       <div key={state} className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-bl-full -z-10 transition group-hover:bg-success/10"></div>
                          <div className="text-success font-black text-4xl mb-4">{state}</div>
                          <div className="space-y-2">
                             <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-gray-400 font-medium">Total Gallons</span>
                                <span className="font-bold text-white">{data.gallons.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-medium">Money Spent</span>
                                <span className="font-bold text-white">${data.cost.toFixed(2)}</span>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-200">
           <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                 <h2 className="text-xl font-bold">Edit Fuel Record</h2>
                 <button onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">State</label>
                    <select value={editState} onChange={e => setEditState(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary">
                       <option value="">Unknown</option>
                       {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">Odometer</label>
                    <input type="text" inputMode="numeric" value={editOdometer ? Number(editOdometer).toLocaleString() : ''} onChange={e => setEditOdometer(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs text-gray-400 font-bold block mb-1">Gallons</label>
                       <input type="number" step="0.001" value={editGallons} onChange={e => setEditGallons(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary" />
                    </div>
                    <div>
                       <label className="text-xs text-gray-400 font-bold block mb-1">Price/Gal</label>
                       <input type="number" step="0.001" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary" />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs text-primary font-bold block mb-1">Total Cost</label>
                    <input type="number" step="0.01" value={editTotal} onChange={e => setEditTotal(e.target.value)} className="w-full bg-primary/10 border border-primary/30 text-primary rounded-xl p-3 font-bold outline-none focus:border-primary" />
                 </div>
              </div>

              <button onClick={handleUpdateLog} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition shadow-[0_0_20px_rgba(59,130,246,0.3)]">Save Changes</button>
           </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-white/10 rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col relative shadow-2xl">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setReceiptModal(null)} className="p-3 bg-black/50 hover:bg-black text-white rounded-full backdrop-blur-md transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-1 bg-white/5 border-b border-white/10 text-center font-bold text-gray-400 py-3 text-sm">Receipt Image Verification</div>
            <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-4">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={receiptModal} alt="Fuel Receipt" className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            <div className="p-4 bg-[#111] border-t border-white/10 flex justify-end">
               <a href={receiptModal} target="_blank" rel="noreferrer" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition text-sm flex items-center">
                 Open Original <FileText className="w-4 h-4 ml-2" />
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DollarSignIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );
}
