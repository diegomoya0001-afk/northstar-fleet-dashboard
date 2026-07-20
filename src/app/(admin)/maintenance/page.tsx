"use client";

import React, { useState, useEffect } from 'react';
import { Wrench, Plus, CheckCircle, AlertTriangle, Search, FileText, MapPin, User, DollarSign, X, Upload, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PinModal from '@/components/PinModal';

export default function ShopVisitsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [faults, setFaults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'visits' | 'schedules' | 'faults'>('visits');
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPmModal, setShowPmModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Security & Editing
  const [showPinModal, setShowPinModal] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
  const [partsInvoiceFile, setPartsInvoiceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // PM State
  const [pmVehicleId, setPmVehicleId] = useState('');
  const [pmTask, setPmTask] = useState('');
  const [pmTrackingMethod, setPmTrackingMethod] = useState<'date' | 'miles'>('date');
  const [pmInterval, setPmInterval] = useState('365');
  const [pmLastDate, setPmLastDate] = useState('');
  const [pmIntervalMiles, setPmIntervalMiles] = useState('');
  const [pmLastMiles, setPmLastMiles] = useState('');
  const [pmAlertMiles, setPmAlertMiles] = useState('2000');
  const [pmSaving, setPmSaving] = useState(false);

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

    // Fetch PM Schedules
    const { data: pmData } = await supabase
      .from('preventive_maintenance')
      .select('*, vehicles(unit_number, make, model, current_odometer)')
      .order('next_due_date', { ascending: true });
    
    if (pmData) setSchedules(pmData);

    // Fetch Fault Codes
    const { data: fData } = await supabase
      .from('vehicle_fault_codes')
      .select('*, vehicles(unit_number)')
      .order('reported_at', { ascending: false });
    if (fData) setFaults(fData);

    setLoading(false);
  }

  async function handleSaveAudit() {
    if (!formVehicleId || !formDateIn || !formWork) {
      alert("Please fill in the required fields (Vehicle, Date In, Work Performed).");
      return;
    }

    setUploading(true);

    let invoiceUrl = editingId ? visits.find(v => v.id === editingId)?.invoice_url : null;
    let partsInvoiceUrl = editingId ? visits.find(v => v.id === editingId)?.parts_invoice_url : null;

    if (invoiceFile) {
      const fileExt = invoiceFile.name.split('.').pop();
      const fileName = `labor-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `shop_invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, invoiceFile);

      if (uploadError) {
        alert("Failed to upload labor invoice: " + uploadError.message);
        setUploading(false);
        return;
      }
      
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      invoiceUrl = data.publicUrl;
    }

    if (partsInvoiceFile) {
      const fileExt = partsInvoiceFile.name.split('.').pop();
      const fileName = `parts-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `shop_invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, partsInvoiceFile);

      if (uploadError) {
        alert("Failed to upload parts invoice: " + uploadError.message);
        setUploading(false);
        return;
      }
      
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      partsInvoiceUrl = data.publicUrl;
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
      parts_invoice_url: partsInvoiceUrl,
      status: formDateOut ? 'completed' : 'pending'
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('shop_visits').update(newVisit).eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('shop_visits').insert([newVisit]);
      error = insertError;
    }

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
    setFormLaborCost(''); setFormPartsCost(''); setFormTax(''); 
    setInvoiceFile(null); setPartsInvoiceFile(null);
    setEditingId(null);
  }

  function handleEditClick(visit: any) {
    setFormVehicleId(visit.vehicle_id || '');
    setFormDateIn(visit.date_in || '');
    setFormDateOut(visit.date_out || '');
    setFormShopName(visit.shop_name || '');
    setFormShopLocation(visit.shop_location || '');
    setFormMechanic(visit.mechanic_name || '');
    setFormWork(visit.work_performed || '');
    setFormParts(visit.parts_replaced || '');
    setFormLaborCost(visit.labor_cost?.toString() || '');
    setFormPartsCost(visit.parts_cost?.toString() || '');
    setFormTax(visit.tax_amount?.toString() || '');
    setEditingId(visit.id);
    setShowModal(true);
  }

  function handleDeleteClick(id: string) {
    setVisitToDelete(id);
    setShowPinModal(true);
  }

  async function handlePinSuccess() {
    setShowPinModal(false);
    if (!visitToDelete) return;
    
    const { error } = await supabase.from('shop_visits').delete().eq('id', visitToDelete);
    if (!error) {
      setVisits(visits.filter(v => v.id !== visitToDelete));
      if (selectedVisit?.id === visitToDelete) setSelectedVisit(null);
    } else {
      alert("Error deleting record: " + error.message);
    }
    setVisitToDelete(null);
  }

  async function handleSavePm() {
    if (!pmVehicleId || !pmTask) {
      alert("Please fill vehicle and task name.");
      return;
    }
    setPmSaving(true);
    
    let newPm: any = {
      vehicle_id: pmVehicleId,
      service_task: pmTask,
      tracking_method: pmTrackingMethod
    };

    if (pmTrackingMethod === 'date') {
      if (!pmInterval || !pmLastDate) { alert("Fill interval and date."); setPmSaving(false); return; }
      const lastDateObj = new Date(pmLastDate);
      const nextDateObj = new Date(lastDateObj.getTime() + (parseInt(pmInterval) * 24 * 60 * 60 * 1000));
      newPm.interval_days = parseInt(pmInterval);
      newPm.last_service_date = pmLastDate;
      newPm.next_due_date = nextDateObj.toISOString().split('T')[0];
    } else {
      if (!pmIntervalMiles || !pmLastMiles || !pmAlertMiles) { alert("Fill miles fields."); setPmSaving(false); return; }
      newPm.interval_miles = parseInt(pmIntervalMiles);
      newPm.last_service_miles = parseInt(pmLastMiles);
      newPm.alert_threshold_miles = parseInt(pmAlertMiles);
      newPm.next_due_miles = parseInt(pmLastMiles) + parseInt(pmIntervalMiles);
    }

    const { error } = await supabase.from('preventive_maintenance').insert([newPm]);
    if (error) {
      alert("Error saving PM: " + error.message);
    } else {
      setShowPmModal(false);
      fetchData();
    }
    setPmSaving(false);
  }

  function getPmStatus(pm: any) {
    if (pm.tracking_method === 'miles') {
      const currentOdo = pm.vehicles?.current_odometer || 0;
      const dueMiles = pm.next_due_miles || 0;
      const alertThresh = pm.alert_threshold_miles || 2000;
      const diff = dueMiles - currentOdo;
      
      if (diff < 0) return { label: 'Overdue', color: 'bg-danger/20 text-danger border-danger/30', detail: `${Math.abs(diff).toLocaleString()} mi over` };
      if (diff <= alertThresh) return { label: 'Due Soon', color: 'bg-warning/20 text-warning border-warning/30', detail: `in ${diff.toLocaleString()} mi` };
      return { label: 'OK', color: 'bg-success/20 text-success border-success/30', detail: `in ${diff.toLocaleString()} mi` };
    } else {
      const diff = (new Date(pm.next_due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (diff < 0) return { label: 'Overdue', color: 'bg-danger/20 text-danger border-danger/30', detail: `${Math.ceil(Math.abs(diff))} days over` };
      if (diff <= 15) return { label: 'Due Soon', color: 'bg-warning/20 text-warning border-warning/30', detail: `in ${Math.ceil(diff)} days` };
      return { label: 'OK', color: 'bg-success/20 text-success border-success/30', detail: `in ${Math.ceil(diff)} days` };
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Maintenance & Shop</h1>
          <p className="text-gray-400 mt-1">Track repairs, log invoices, and monitor compliance schedules</p>
          <div className="flex space-x-6 mt-6">
            <button onClick={() => setActiveTab('visits')} className={`pb-2 font-semibold transition ${activeTab === 'visits' ? 'border-b-2 border-primary text-white' : 'text-gray-500 hover:text-gray-300'}`}>Shop Visits & History</button>
            <button onClick={() => setActiveTab('schedules')} className={`pb-2 font-semibold transition ${activeTab === 'schedules' ? 'border-b-2 border-blue-400 text-white' : 'text-gray-500 hover:text-gray-300'}`}>PM Schedules & Alerts</button>
            <button onClick={() => setActiveTab('faults')} className={`pb-2 font-semibold transition ${activeTab === 'faults' ? 'border-b-2 border-warning text-white' : 'text-gray-500 hover:text-gray-300'}`}>Engine Faults (DTC)</button>
          </div>
        </div>
        <div>
          {activeTab === 'visits' && (
            <button 
              onClick={() => { resetForm(); setShowModal(true); }}
              className="glass-button px-6 py-3 font-semibold bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Shop Visit
            </button>
          )}
          {activeTab === 'schedules' && (
            <button 
              onClick={() => { setPmVehicleId(''); setPmTask(''); setPmTrackingMethod('date'); setPmInterval('365'); setPmLastDate(''); setShowPmModal(true); }}
              className="glass-button px-6 py-3 font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Schedule
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Table Area */}
        {activeTab === 'visits' && (
          <>
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
                    <th className="pb-4 font-medium pl-4">Work Performed</th>
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
                      <td className="py-4 pl-4"><div className="font-medium text-sm text-white truncate max-w-[250px]" title={visit.work_performed}>{visit.work_performed || 'N/A'}</div></td>
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
                        <div className="flex gap-2">
                          {visit.invoice_url ? <a href={visit.invoice_url} target="_blank" rel="noreferrer" title="Labor Invoice"><FileText className="w-5 h-5 text-success" /></a> : <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">No Labor Inv</span>}
                          {visit.parts_invoice_url ? <a href={visit.parts_invoice_url} target="_blank" rel="noreferrer" title="Parts Invoice"><FileText className="w-5 h-5 text-blue-400" /></a> : null}
                        </div>
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
              <div className="flex space-x-2">
                <button onClick={() => handleEditClick(selectedVisit)} className="p-2 hover:bg-white/10 rounded-full transition" title="Edit Record">
                  <Edit className="w-5 h-5 text-blue-400" />
                </button>
                <button onClick={() => handleDeleteClick(selectedVisit.id)} className="p-2 hover:bg-white/10 rounded-full transition" title="Delete Record">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
                <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
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

              <div className="grid grid-cols-2 gap-4">
                {selectedVisit.invoice_url ? (
                  <a href={selectedVisit.invoice_url} target="_blank" rel="noreferrer" className="py-3 bg-primary/20 text-primary font-bold rounded-xl border border-primary/30 hover:bg-primary/30 transition flex flex-col items-center justify-center text-xs">
                    <FileText className="w-5 h-5 mb-1" /> Labor Invoice
                  </a>
                ) : (
                  <div className="py-3 bg-white/5 text-gray-500 font-bold rounded-xl border border-white/10 flex flex-col items-center justify-center text-xs">
                    <FileText className="w-5 h-5 mb-1 opacity-50" /> No Labor Inv
                  </div>
                )}

                {selectedVisit.parts_invoice_url ? (
                  <a href={selectedVisit.parts_invoice_url} target="_blank" rel="noreferrer" className="py-3 bg-blue-500/20 text-blue-400 font-bold rounded-xl border border-blue-500/30 hover:bg-blue-500/30 transition flex flex-col items-center justify-center text-xs">
                    <FileText className="w-5 h-5 mb-1" /> Parts Invoice
                  </a>
                ) : (
                  <div className="py-3 bg-white/5 text-gray-500 font-bold rounded-xl border border-white/10 flex flex-col items-center justify-center text-xs">
                    <FileText className="w-5 h-5 mb-1 opacity-50" /> No Parts Inv
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          </>
        )}
        
        {/* PM Schedules Tab */}
        {activeTab === 'schedules' && (
          <div className="glass-panel flex flex-col p-6 overflow-hidden w-full">
            <div className="flex justify-between mb-6">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search truck or service..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500/50 text-white placeholder-gray-500"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-auto hide-scrollbar">
              {schedules.filter(s => `${s.vehicles?.unit_number} ${s.service_task}`.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full text-gray-500">
                  <AlertTriangle className="w-16 h-16 mb-4 opacity-50" />
                  <p>No preventive maintenance schedules defined.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                      <th className="pb-4 font-medium pl-4">Truck</th>
                      <th className="pb-4 font-medium">Service Task</th>
                      <th className="pb-4 font-medium">Interval (Days)</th>
                      <th className="pb-4 font-medium">Last Done</th>
                      <th className="pb-4 font-medium">Next Due</th>
                      <th className="pb-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.filter(s => `${s.vehicles?.unit_number} ${s.service_task}`.toLowerCase().includes(searchTerm.toLowerCase())).map((pm) => {
                      const stat = getPmStatus(pm);
                      return (
                        <tr key={pm.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-4 font-bold text-blue-400">{pm.vehicles?.unit_number || 'Unknown'}</td>
                          <td className="py-4 font-medium">{pm.service_task} <span className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{pm.tracking_method === 'miles' ? 'MILES' : 'DATE'}</span></td>
                          <td className="py-4 text-gray-300">{pm.tracking_method === 'miles' ? `Every ${pm.interval_miles?.toLocaleString() || 0} mi` : `Every ${pm.interval_days} days`}</td>
                          <td className="py-4 text-gray-400">{pm.tracking_method === 'miles' ? `${pm.last_service_miles?.toLocaleString() || 0} mi` : pm.last_service_date}</td>
                          <td className="py-4 font-bold text-white">{pm.tracking_method === 'miles' ? `${pm.next_due_miles?.toLocaleString() || 0} mi` : pm.next_due_date}</td>
                          <td className="py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${stat.color}`}>
                              {stat.label}
                            </span>
                            <div className="text-[10px] text-gray-500 mt-1">{stat.detail}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Engine Faults (DTC) Tab */}
        {activeTab === 'faults' && (
          <div className="glass-panel flex flex-col p-6 overflow-hidden w-full">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center text-warning"><AlertTriangle className="mr-2" /> Active Engine Faults (DTC)</h2>
                <p className="text-sm text-gray-400">Live telematics alerts powered by Motive</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto hide-scrollbar">
              {faults.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full text-gray-500">
                  <CheckCircle className="w-16 h-16 mb-4 opacity-50 text-success" />
                  <p>All clear! No active engine faults reported across the fleet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {faults.map(fault => (
                    <div key={fault.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col relative overflow-hidden">
                      {fault.severity === 'high' && <div className="absolute top-0 left-0 w-1 h-full bg-danger"></div>}
                      {fault.severity === 'medium' && <div className="absolute top-0 left-0 w-1 h-full bg-warning"></div>}
                      <div className="flex justify-between items-start mb-3 pl-2">
                        <div>
                          <div className="text-xs text-gray-400 font-mono mb-1">TRUCK {fault.vehicles?.unit_number || 'UNKNOWN'}</div>
                          <div className="font-bold text-xl text-white">{fault.code}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${fault.severity === 'high' ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-warning/20 text-warning border border-warning/30'}`}>
                          {fault.severity} SEVERITY
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 pl-2 mb-4 flex-1">{fault.description || 'No description available'}</p>
                      <div className="flex justify-between items-center text-xs text-gray-500 pl-2 pt-3 border-t border-white/10">
                        <span>Reported: {new Date(fault.reported_at).toLocaleString()}</span>
                        <button className="text-blue-400 hover:text-white font-semibold transition">Mark Resolved</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add PM Modal */}
      {showPmModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold">New PM Schedule</h2>
              <button onClick={() => setShowPmModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vehicle *</label>
                <select value={pmVehicleId} onChange={e => setPmVehicleId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50">
                  <option value="" className="bg-[#111]">Select a Vehicle...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id} className="bg-[#111]">{v.unit_number} - {v.make}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Service Task *</label>
                <input type="text" value={pmTask} onChange={e => setPmTask(e.target.value)} placeholder="e.g. Annual DOT Inspection or Oil Change" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
              </div>
              
              <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 mb-4 mt-6">
                <button 
                  onClick={() => setPmTrackingMethod('date')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${pmTrackingMethod === 'date' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                >Track by Date</button>
                <button 
                  onClick={() => setPmTrackingMethod('miles')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${pmTrackingMethod === 'miles' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                >Track by Miles</button>
              </div>

              {pmTrackingMethod === 'date' ? (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Interval (Days) *</label>
                    <input type="number" value={pmInterval} onChange={e => setPmInterval(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Last Completed Date *</label>
                    <input type="date" value={pmLastDate} onChange={e => setPmLastDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Interval (Miles) *</label>
                      <input type="number" value={pmIntervalMiles} onChange={e => setPmIntervalMiles(e.target.value)} placeholder="e.g. 9000" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Last Serviced (Miles) *</label>
                      <input type="number" value={pmLastMiles} onChange={e => setPmLastMiles(e.target.value)} placeholder="e.g. 150000" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Alert me before (Miles) *</label>
                    <input type="number" value={pmAlertMiles} onChange={e => setPmAlertMiles(e.target.value)} placeholder="e.g. 2000" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" />
                    <p className="text-[10px] text-gray-500 mt-1">We will flag this as 'Due Soon' when it hits this threshold.</p>
                  </div>
                </div>
              )}
              
            </div>
            
            <div className="flex justify-end mt-8">
              <button onClick={() => setShowPmModal(false)} className="px-6 py-2 rounded-xl font-bold text-gray-400 hover:text-white mr-4">Cancel</button>
              <button onClick={handleSavePm} disabled={pmSaving} className="px-6 py-2 rounded-xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                {pmSaving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Record Modal */}
      {showModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-4xl max-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingId ? 'Edit Shop Visit' : 'Log New Shop Visit'}</h2>
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

                <div className="pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Labor Invoice (PDF/Img)</label>
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:bg-white/5 transition cursor-pointer relative">
                      <input 
                        type="file" 
                        onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileText className={`w-6 h-6 mx-auto mb-1 ${invoiceFile ? 'text-primary' : 'text-gray-400'}`} />
                      <span className="text-[10px] text-gray-300 truncate block">
                        {invoiceFile ? invoiceFile.name : 'Upload Labor'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Parts Invoice (PDF/Img)</label>
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:bg-white/5 transition cursor-pointer relative">
                      <input 
                        type="file" 
                        onChange={e => setPartsInvoiceFile(e.target.files ? e.target.files[0] : null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileText className={`w-6 h-6 mx-auto mb-1 ${partsInvoiceFile ? 'text-blue-400' : 'text-gray-400'}`} />
                      <span className="text-[10px] text-gray-300 truncate block">
                        {partsInvoiceFile ? partsInvoiceFile.name : 'Upload Parts'}
                      </span>
                    </div>
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
      {/* Pin Modal for Deletions */}
      <PinModal 
        isOpen={showPinModal} 
        onClose={() => setShowPinModal(false)} 
        onSuccess={handlePinSuccess}
        actionText="delete this audit record"
      />
    </div>
  );
}
