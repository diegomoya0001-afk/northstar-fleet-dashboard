"use client";

import React, { useState, useEffect } from 'react';
import { Wrench, Plus, CheckCircle, AlertTriangle, Search, FileText, MapPin, User, DollarSign, X, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ShopVisitsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formDateIn, setFormDateIn] = useState('');
  const [formDateOut, setFormDateOut] = useState('');
  const [formShopName, setFormShopName] = useState('');
  const [formShopLocation, setFormShopLocation] = useState('');
  const [formMechanic, setFormMechanic] = useState('');
  const [formWork, setFormWork] = useState('');
  const [formParts, setFormParts] = useState('');
  const [formLaborCost, setFormLaborCost] = useState('');
  const [formPartsCost, setFormPartsCost] = useState('');
  const [formTax, setFormTax] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // Fetch vehicles for the dropdown
    const { data: vData } = await supabase.from('vehicles').select('id, unit_number, make, model').order('unit_number');
    if (vData) setVehicles(vData);

    // Fetch visits
    const { data: sData } = await supabase
      .from('shop_visits')
      .select('*, vehicles(unit_number, make, model), users(first_name, last_name)')
      .order('date_in', { ascending: false });
    
    if (sData) setVisits(sData);
    setLoading(false);
  }

  async function handleSaveAudit() {
    if (!formVehicleId || !formDateIn || !formWork) {
      alert("Please fill in the required fields (Vehicle, Date In, Work Performed).");
      return;
    }

    setUploading(true);

    let invoiceUrl = null;
    if (invoiceFile) {
      const fileExt = invoiceFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `shop_invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, invoiceFile);

      if (uploadError) {
        alert("Failed to upload invoice: " + uploadError.message);
        setUploading(false);
        return;
      }
      
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      invoiceUrl = data.publicUrl;
    }

    const lCost = parseFloat(formLaborCost) || 0;
    const pCost = parseFloat(formPartsCost) || 0;
    const tCost = parseFloat(formTax) || 0;
    const total = lCost + pCost + tCost;

    const newVisit = {
      vehicle_id: formVehicleId,
      date_in: formDateIn,
      date_out: formDateOut || null,
      shop_name: formShopName,
      shop_location: formShopLocation,
      mechanic_name: formMechanic,
      work_performed: formWork,
      parts_replaced: formParts,
      labor_cost: lCost,
      parts_cost: pCost,
      tax_amount: tCost,
      total_cost: total,
      invoice_url: invoiceUrl,
      status: formDateOut ? 'completed' : 'pending'
    };

    const { error } = await supabase.from('shop_visits').insert([newVisit]);

    if (error) {
      alert("Error saving record: " + error.message);
    } else {
      setShowModal(false);
      resetForm();
      fetchData();
    }
    setUploading(false);
  }

  function resetForm() {
    setFormVehicleId(''); setFormDateIn(''); setFormDateOut(''); setFormShopName('');
    setFormShopLocation(''); setFormMechanic(''); setFormWork(''); setFormParts('');
    setFormLaborCost(''); setFormPartsCost(''); setFormTax(''); setInvoiceFile(null);
  }

  // Calculate stats
  const activeVisits = visits.filter(v => v.status === 'pending').length;
  const mtdCost = visits.reduce((acc, v) => acc + (v.total_cost || 0), 0);
  const auditedCount = visits.filter(v => v.status === 'completed').length;

  const filteredVisits = visits.filter(v => {
    const searchStr = `${v.vehicles?.unit_number} ${v.shop_name} ${v.work_performed}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop Visits & Audits</h1>
          <p className="text-gray-400 mt-1">Detailed maintenance tracking, costs, and mechanic logs</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="glass-button px-6 py-3 font-semibold bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Shop Visit
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Table Area */}
        <div className={`glass-panel flex flex-col p-6 overflow-hidden transition-all duration-300 ${selectedVisit ? 'w-2/3' : 'w-full'}`}>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center mr-4">
                <Wrench className="w-6 h-6 text-warning" />
              </div>
              <div>
                <div className="text-gray-400 text-sm">Active Shop Visits</div>
                <div className="text-2xl font-bold">{activeVisits}</div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-gray-400 text-sm">Total Maintenance Cost</div>
                <div className="text-2xl font-bold">${mtdCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mr-4">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <div className="text-gray-400 text-sm">Audited Records</div>
                <div className="text-2xl font-bold">{auditedCount}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between mb-6">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search truck, shop, or work..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary/50 text-white placeholder-gray-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto hide-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-400">Loading audit records...</div>
            ) : filteredVisits.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-gray-500">
                <Wrench className="w-16 h-16 mb-4 opacity-50" />
                <p>No shop visits logged yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-sm">
                    <th className="pb-4 font-medium pl-4">Visit ID</th>
                    <th className="pb-4 font-medium">Dates (In/Out)</th>
                    <th className="pb-4 font-medium">Truck & Shop</th>
                    <th className="pb-4 font-medium">Total Cost</th>
                    <th className="pb-4 font-medium">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((visit) => (
                    <tr 
                      key={visit.id} 
                      onClick={() => setSelectedVisit(visit)}
                      className={`border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer ${selectedVisit?.id === visit.id ? 'bg-white/10' : ''}`}
                    >
                      <td className="py-4 pl-4 font-bold text-xs font-mono">{visit.id.split('-')[0]}...</td>
                      <td className="py-4 text-gray-300">
                        <div>IN: {visit.date_in}</div>
                        <div className="text-xs text-gray-500">OUT: {visit.date_out || 'Pending'}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-semibold text-primary">{visit.vehicles?.unit_number || 'Unknown Truck'}</div>
                        <div className="text-xs text-gray-400 mt-1">{visit.shop_name || 'N/A'} {visit.is_driver_reported && <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">APP</span>}</div>
                      </td>
                      <td className="py-4 font-bold text-white">${Number(visit.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="py-4">
                        {visit.invoice_url ? <FileText className="w-5 h-5 text-success" /> : <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">Missing</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Side Panel: Audit Details */}
        {selectedVisit && (
          <div className="glass-panel w-1/3 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold">Audit Details</h2>
              <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {selectedVisit.is_driver_reported && (
                <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-3 rounded-xl flex items-start text-sm">
                  <User className="w-5 h-5 mr-3 shrink-0" />
                  <div>
                    <span className="font-bold block">Reported by Driver</span>
                    This shop visit was logged directly from the Driver App by {selectedVisit.users?.first_name} {selectedVisit.users?.last_name}.
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Service Overview</h3>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Truck ID:</span>
                    <span className="font-bold text-primary">{selectedVisit.vehicles?.unit_number}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Date In:</span>
                    <span>{selectedVisit.date_in}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Date Out:</span>
                    <span>{selectedVisit.date_out || 'Still in shop'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Shop & Mechanic</h3>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center">
                    <Wrench className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="font-medium">{selectedVisit.shop_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-300 text-sm">{selectedVisit.shop_location || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-300 text-sm">Mechanic: {selectedVisit.mechanic_name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Work & Parts</h3>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Work Performed</div>
                    <div className="text-sm font-medium">{selectedVisit.work_performed}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Parts Replaced</div>
                    <div className="text-sm">{selectedVisit.parts_replaced || 'None listed'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Financial Breakdown</h3>
                <div className="bg-gradient-to-br from-black/60 to-black/40 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-gray-400">Labor Cost:</span>
                    <span>${Number(selectedVisit.labor_cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-gray-400">Parts Cost:</span>
                    <span>${Number(selectedVisit.parts_cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between mb-4 text-sm">
                    <span className="text-gray-400">Tax/Fees:</span>
                    <span>${Number(selectedVisit.tax_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="font-bold">Total Invoice:</span>
                    <span className="text-xl font-bold text-success">${Number(selectedVisit.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              {selectedVisit.invoice_url ? (
                <a href={selectedVisit.invoice_url} target="_blank" rel="noreferrer" className="w-full py-3 bg-primary/20 text-primary font-bold rounded-xl border border-primary/30 hover:bg-primary/30 transition flex items-center justify-center">
                  <FileText className="w-5 h-5 mr-2" /> View Scanned Invoice
                </a>
              ) : (
                <div className="w-full py-3 bg-white/5 text-gray-500 font-bold rounded-xl border border-white/10 text-center text-sm">
                  No Invoice Uploaded
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      {showModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-4xl max-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Log New Shop Visit</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-primary border-b border-white/10 pb-2">General Info</h3>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Vehicle *</label>
                  <select 
                    value={formVehicleId} onChange={e => setFormVehicleId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="" className="bg-[#111]">Select a Vehicle...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#111]">{v.unit_number} - {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Date In *</label>
                    <input type="date" value={formDateIn} onChange={e => setFormDateIn(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Date Out</label>
                    <input type="date" value={formDateOut} onChange={e => setFormDateOut(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                  </div>
                </div>
                
                <h3 className="font-semibold text-primary border-b border-white/10 pb-2 mt-6">Shop Details</h3>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Shop Name</label>
                  <input type="text" value={formShopName} onChange={e => setFormShopName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="e.g. Freightliner Dallas" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Location / Address</label>
                  <input type="text" value={formShopLocation} onChange={e => setFormShopLocation(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="City, State" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Mechanic Name</label>
                  <input type="text" value={formMechanic} onChange={e => setFormMechanic(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="John Doe" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-primary border-b border-white/10 pb-2">Work & Costs</h3>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Work Performed *</label>
                  <textarea value={formWork} onChange={e => setFormWork(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white h-20" placeholder="Detailed description of repairs..."></textarea>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Parts Replaced</label>
                  <textarea value={formParts} onChange={e => setFormParts(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white h-16" placeholder="List of new parts..."></textarea>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Labor Cost ($)</label>
                    <input type="number" value={formLaborCost} onChange={e => setFormLaborCost(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Parts Cost ($)</label>
                    <input type="number" value={formPartsCost} onChange={e => setFormPartsCost(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Tax ($)</label>
                    <input type="number" value={formTax} onChange={e => setFormTax(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="0.00" />
                  </div>
                </div>

                <div className="pt-4">
                  <label className="text-xs text-gray-400 block mb-1">Upload Invoice (PDF/JPG/PNG)</label>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:bg-white/5 transition cursor-pointer relative">
                    <input 
                      type="file" 
                      onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-8 h-8 mx-auto mb-2 ${invoiceFile ? 'text-primary' : 'text-gray-400'}`} />
                    <span className="text-sm text-gray-300">
                      {invoiceFile ? invoiceFile.name : 'Click to upload scanned document'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 pt-6 border-t border-white/10">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button onClick={handleSaveAudit} disabled={uploading} className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30 disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Save Audit Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
