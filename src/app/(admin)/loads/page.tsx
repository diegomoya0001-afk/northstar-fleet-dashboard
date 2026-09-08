"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, MapPin, User, ChevronRight, X, Edit2, FileText, Upload, DollarSign, Calendar, Truck, Trash2, Wand2, ShieldCheck, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InvoiceModal from '@/components/InvoiceModal';
import { exportToExcel } from '@/utils/excelExport';

export default function LoadsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered'>('active');
  const [loads, setLoads] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dispatchers, setDispatchers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Form states
  const [formLoadNumber, setFormLoadNumber] = useState('');
  const [formBrokerId, setFormBrokerId] = useState('');
  const [formBroker, setFormBroker] = useState('');
  const [formBrokerMC, setFormBrokerMC] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formLoadedMiles, setFormLoadedMiles] = useState('');
  const [formDeadheadMiles, setFormDeadheadMiles] = useState('');
  const [formStatus, setFormStatus] = useState('available');
  const [formDriverId, setFormDriverId] = useState('');
  const [formDispatcherId, setFormDispatcherId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAdditionalExpenses, setFormAdditionalExpenses] = useState('');
  const [formStops, setFormStops] = useState<any[]>([
     { type: 'pickup', location: '', address: '', date: '' },
     { type: 'delivery', location: '', address: '', date: '' }
  ]);

  // AI Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document Upload States
  const [docType, setDocType] = useState('rate_con');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Fuel Costs State
  const [loadFuelCost, setLoadFuelCost] = useState<number | null>(null);

  useEffect(() => {
    fetchLoads();
    fetchDrivers();
    fetchDispatchers();
    fetchBrokers();
    fetchSettings();
  }, []);

  async function fetchBrokers() {
    const { data } = await supabase.from('brokers').select('id, name, mc_number');
    if (data) setBrokers(data);
  }

  async function fetchSettings() {
    const { data } = await supabase.from('company_settings').select('*').limit(1).single();
    if (data) setSettings(data);
  }

  async function fetchLoads() {
    setLoading(true);
    const { data, error } = await supabase
      .from('loads')
      .select(`
        *,
        users!loads_assigned_driver_id_fkey(first_name, last_name, vehicles!vehicles_assigned_driver_id_fkey(plate_number, unit_number, type, current_location_lat, current_location_lng)),
        dispatcher:users!dispatcher_id(first_name, last_name, commission_rate)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLoads(data);
      if (selectedLoad) {
        const updated = data.find((l: any) => l.id === selectedLoad.id);
        if (updated) setSelectedLoad({ ...selectedLoad, ...updated });
      }
    }
    setLoading(false);
  }

  async function fetchDrivers() {
    const { data, error } = await supabase.from('users').select('id, first_name, last_name').eq('role', 'driver');
    if (!error && data) setDrivers(data);
  }

  async function fetchDispatchers() {
    const { data, error } = await supabase.from('users').select('id, first_name, last_name').in('role', ['manager', 'admin', 'dispatcher']);
    if (!error && data) setDispatchers(data);
  }

  useEffect(() => {
    if (selectedLoad) {
      if (!selectedLoad.documents) fetchDocuments(selectedLoad.id);
      fetchLoadFuelCost(selectedLoad.id);
    }
  }, [selectedLoad?.id]);

  async function fetchLoadFuelCost(loadId: string) {
    const { data, error } = await supabase.from('fuel_logs').select('total_cost').eq('load_id', loadId);
    if (!error && data) {
       const total = data.reduce((acc, log) => acc + Number(log.total_cost || 0), 0);
       setLoadFuelCost(total);
    } else {
       setLoadFuelCost(0);
    }
  }

  async function fetchDocuments(loadId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', 'load')
      .eq('entity_id', loadId);
    
    if (!error && data) {
      setSelectedLoad((prev: any) => prev ? { ...prev, documents: data } : null);
    }
  }

  function resetForm() {
    setFormLoadNumber(''); setFormBrokerId(''); setFormBroker(''); setFormBrokerMC(''); setFormRate(''); 
    setFormWeight(''); setFormLoadedMiles(''); setFormDeadheadMiles('');
    setFormStatus('available'); setFormDriverId(''); setFormDispatcherId(''); setFormNotes(''); setFormAdditionalExpenses('');
    setFormStops([
       { type: 'pickup', location: '', address: '', date: '' },
       { type: 'delivery', location: '', address: '', date: '' }
    ]);
  }

  // --- MAGIC OCR UPLOAD ---
  async function handleAutoFillUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-rc', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        setFormLoadNumber(data.data.loadNumber || '');
        setFormBroker(data.data.brokerName || '');
        setFormBrokerMC(data.data.brokerMC || '');
        setFormRate(data.data.rate || '');
        
        if (data.data.stops && data.data.stops.length > 0) {
           setFormStops(data.data.stops);
        } else {
           setFormStops([
              { type: 'pickup', location: data.data.pickupLocation || '', address: data.data.pickupAddress || '', date: data.data.pickupDate || '' },
              { type: 'delivery', location: data.data.deliveryLocation || '', address: data.data.deliveryAddress || '', date: data.data.deliveryDate || '' }
           ]);
        }

        setFormWeight(data.data.weight || '');
        
        let milesStr = data.data.loadedMiles || '';
        if (!milesStr && data.data.pickupAddress && data.data.deliveryAddress) {
           const calcMiles = await calculateMiles(data.data.pickupAddress, data.data.deliveryAddress);
           if (calcMiles) milesStr = calcMiles.toString();
        }
        setFormLoadedMiles(milesStr);
        setFormNotes(data.data.notes || '');
        // We can automatically upload this document to the vault after the load is created.
        alert("Rate Confirmation successfully read! Please verify the details before saving.");
      } else {
        alert(data.error || "Failed to parse document");
      }
    } catch (error) {
      console.error(error);
      alert("Error contacting parsing server.");
    }
    setIsParsing(false);
  }

  async function calculateMiles(origin: string, destination: string): Promise<number | null> {
    try {
      const res = await fetch('/api/calculate-miles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination })
      });
      const data = await res.json();
      if (data.success) {
        return data.miles;
      } else {
        console.warn("Failed to calculate miles:", data.error);
        return null;
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function handleManualCalculateMiles() {
    const originStop = formStops.find(s => s.type === 'pickup');
    const destStop = [...formStops].reverse().find(s => s.type === 'delivery');
    const origin = originStop?.address || originStop?.location;
    const dest = destStop?.address || destStop?.location;
    
    if (!origin || !dest) {
      alert("Please enter at least the pickup and delivery cities/addresses to calculate miles.");
      return;
    }
    const miles = await calculateMiles(origin, dest);
    if (miles) {
      setFormLoadedMiles(miles.toString());
    } else {
      alert("Failed to calculate miles. Please check your Google Maps API Key.");
    }
  }

  async function handleCalculateDeadheadMiles() {
    if (!formDriverId) {
       alert("Please select a driver first to calculate deadhead miles based on their truck's location.");
       return;
    }
    const originStop = formStops.find(s => s.type === 'pickup');
    const dest = originStop?.address || originStop?.location;
    if (!dest) {
       alert("Please enter a pickup location/address first.");
       return;
    }
    
    // Find driver's truck location
    const { data: userData, error } = await supabase
       .from('users')
       .select(`vehicles!vehicles_assigned_driver_id_fkey(current_location_lat, current_location_lng)`)
       .eq('id', formDriverId)
       .single();
       
    if (error || !userData?.vehicles?.[0]) {
       alert("Could not find an assigned truck for this driver, or location is unavailable.");
       return;
    }
    
    const truck = userData.vehicles[0];
    if (!truck.current_location_lat || !truck.current_location_lng) {
       alert("Truck's current GPS location is not available in Motive yet.");
       return;
    }
    
    const origin = `${truck.current_location_lat},${truck.current_location_lng}`;
    const miles = await calculateMiles(origin, dest);
    
    if (miles !== null) {
       setFormDeadheadMiles(miles.toString());
    } else {
       alert("Failed to calculate deadhead miles. Please check the pickup address.");
    }
  }

  async function handleCreateLoad() {
    if (!formLoadNumber || !formBroker || !formRate) {
      alert("Load Number, Broker, and Rate are required.");
      return;
    }

    let finalBrokerId = formBrokerId;

    // Auto-create broker if not selected from list
    if (!finalBrokerId && formBroker) {
       const { data: existing } = await supabase.from('brokers').select('id').ilike('name', formBroker).limit(1);
       if (existing && existing.length > 0) {
          finalBrokerId = existing[0].id;
       } else {
          const { data: newBroker } = await supabase.from('brokers').insert([{
             name: formBroker,
             mc_number: formBrokerMC || null,
             credit_score: 'A'
          }]).select('id').single();
          
          if (newBroker) {
             finalBrokerId = newBroker.id;
             fetchBrokers();
          }
       }
    }

    const originStop = formStops.find(s => s.type === 'pickup') || formStops[0];
    const destStop = [...formStops].reverse().find(s => s.type === 'delivery') || formStops[formStops.length - 1];

    if (!originStop?.location || !destStop?.location) {
       alert("Please enter at least one pickup and one delivery location in the stops list.");
       return;
    }

    const newLoad = {
      load_number: formLoadNumber,
      broker_id: finalBrokerId || null,
      broker_name: formBroker,
      broker_mc: formBrokerMC,
      rate: parseFloat(formRate),
      pickup_location: originStop.location,
      pickup_address: originStop.address || '',
      pickup_date: originStop.date || null,
      delivery_location: destStop.location,
      delivery_address: destStop.address || '',
      delivery_date: destStop.date || null,
      weight: formWeight ? parseFloat(formWeight) : null,
      loaded_miles: formLoadedMiles ? parseFloat(formLoadedMiles) : null,
      deadhead_miles: formDeadheadMiles ? parseFloat(formDeadheadMiles) : 0,
      status: formStatus,
      assigned_driver_id: formDriverId || null,
      dispatcher_id: formDispatcherId || null,
      additional_expenses: formAdditionalExpenses ? parseFloat(formAdditionalExpenses) : 0,
      notes: formNotes,
      stops: formStops
    };

    const { error } = await supabase.from('loads').insert([newLoad]);
    if (!error) {
      setShowAddModal(false);
      fetchLoads();
      resetForm();

      if (newLoad.assigned_driver_id) {
        try {
          await fetch('/api/notify-driver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId: newLoad.assigned_driver_id,
              loadNumber: newLoad.load_number,
              pickupLocation: newLoad.pickup_location,
              deliveryLocation: newLoad.delivery_location
            })
          });
        } catch (e) {
          console.error("SMS notification failed on create:", e);
        }
      }
    } else {
      alert("Error: " + error.message);
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!selectedLoad) return;
    const { error } = await supabase.from('loads').update({ status: newStatus }).eq('id', selectedLoad.id);
    if (!error) {
      fetchLoads();
    }
  }

  async function handleReconcileFinancials() {
    if (!selectedLoad || reconciling) return;
    setReconciling(true);
    
    const dFeePercent = settings?.dispatcher_fee_percent !== undefined ? Number(settings.dispatcher_fee_percent) : 5;
    const fFeePercent = settings?.factoring_fee_percent !== undefined ? Number(settings.factoring_fee_percent) : 2.5;
    const achFee = settings?.factoring_ach_fee !== undefined ? Number(settings.factoring_ach_fee) : 5;

    const rate = selectedLoad.rate || 0;
    const fuel = loadFuelCost || 0;
    const dispatchFee = rate * (dFeePercent / 100);
    const driverPay = rate * 0.25;
    const driverTaxes = driverPay * 0.0765;
    const factoringFee = (rate * (fFeePercent / 100)) + achFee;
    const maintReserve = rate * 0.05;
    const totalExpenses = dispatchFee + driverPay + driverTaxes + factoringFee + maintReserve + fuel;
    const netProfit = rate - totalExpenses;

    const { error } = await supabase.from('load_financials').insert([{
       load_id: selectedLoad.id,
       rate: rate,
       driver_pay: driverPay,
       driver_taxes: driverTaxes,
       dispatch_fee: dispatchFee,
       factoring_fee: factoringFee,
       maintenance_reserve: maintReserve,
       fuel_costs: fuel,
       net_profit: netProfit,
       status: 'reconciled'
    }]);

    if (!error) {
       alert("Financials successfully reconciled and frozen for this load.");
       setReconciling(false);
       fetchLoads();
    } else {
       if (error.code === '23505') {
          alert("This load has already been reconciled.");
       } else {
          alert("Error reconciling financials: " + error.message);
       }
       setReconciling(false);
    }
  }

  async function handleAssignDriver() {
    if (!selectedLoad || !assigningDriverId) return;
    
    // Update Supabase
    const { error } = await supabase
      .from('loads')
      .update({ assigned_driver_id: assigningDriverId, status: selectedLoad.status === 'available' ? 'dispatched' : selectedLoad.status })
      .eq('id', selectedLoad.id);
      
    if (!error) {
      await fetchLoads();
      
      // Notify Driver via API (Simulates SMS)
      try {
        const res = await fetch('/api/notify-driver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: assigningDriverId,
            loadNumber: selectedLoad.load_number,
            pickupLocation: selectedLoad.pickup_location,
            deliveryLocation: selectedLoad.delivery_location
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Driver Assigned! SMS notification sent to ${data.sentTo}`);
        } else {
          alert('Driver assigned, but failed to send SMS: ' + data.error);
        }
      } catch (err) {
        alert('Driver assigned, but SMS API call failed.');
      }
      setShowAssignModal(false);
      setAssigningDriverId('');
    } else {
      alert('Failed to assign driver: ' + error.message);
    }
  }

  async function handleDeleteLoad() {
    if (!selectedLoad) return;
    if (!confirm('Are you sure you want to delete this load? This action cannot be undone.')) return;
    
    // First, delete documents associated with this load
    if (selectedLoad.documents && selectedLoad.documents.length > 0) {
      for (const doc of selectedLoad.documents) {
        const filePath = `loads/${doc.file_url.split('/').pop()}`;
        await supabase.storage.from('documents').remove([filePath]);
      }
      await supabase.from('documents').delete().eq('entity_type', 'load').eq('entity_id', selectedLoad.id);
    }
    
    const { error } = await supabase.from('loads').delete().eq('id', selectedLoad.id);
    if (!error) {
      setSelectedLoad(null);
      fetchLoads();
    } else {
      alert('Error deleting load: ' + error.message);
    }
  }

  async function handleUploadDocument() {
    if (!selectedLoad || !docFile) return;

    setUploading(true);
    const fileExt = docFile.name.split('.').pop();
    const fileName = `load-${selectedLoad.id}-${Date.now()}.${fileExt}`;
    const filePath = `loads/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, docFile);
    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

    const { error: dbError } = await supabase.from('documents').insert([{
      entity_type: 'load',
      entity_id: selectedLoad.id,
      doc_type: docType,
      file_url: publicUrl,
      notes: docFile.name
    }]);

    if (!dbError) {
      setShowUploadModal(false);
      setDocFile(null);
      fetchDocuments(selectedLoad.id);
    }
    setUploading(false);
  }

  async function handleDeleteDocument(doc: any) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const filePath = `loads/${doc.file_url.split('/').pop()}`;
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocuments(selectedLoad.id);
  }

  const filteredLoads = loads.filter(l => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['available', 'dispatched', 'at_pickup', 'in_transit', 'at_delivery'].includes(l.status);
    if (activeTab === 'delivered') return ['delivered', 'invoiced', 'paid'].includes(l.status);
    return true;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'available': return 'bg-gray-500/20 text-gray-400';
      case 'dispatched': return 'bg-blue-500/20 text-blue-400';
      case 'at_pickup': return 'bg-yellow-500/20 text-yellow-500';
      case 'in_transit': return 'bg-orange-500/20 text-orange-400';
      case 'at_delivery': return 'bg-yellow-500/20 text-yellow-500';
      case 'delivered': return 'bg-success/20 text-success';
      case 'invoiced': return 'bg-purple-500/20 text-purple-400';
      case 'paid': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredLoads.map(l => ({
      'Load Number': l.load_number,
      'Status': l.status,
      'Broker': l.broker_name,
      'Rate': l.rate,
      'Pickup': l.pickup_location,
      'Pickup Date': l.pickup_date,
      'Delivery': l.delivery_location,
      'Delivery Date': l.delivery_date,
      'Driver': l.users ? `${l.users.first_name} ${l.users.last_name}` : '',
      'Dispatcher': l.dispatcher ? `${l.dispatcher.first_name} ${l.dispatcher.last_name}` : ''
    }));
    exportToExcel(dataToExport, 'loads_export');
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Load Board & Dispatch</h1>
          <p className="text-gray-400 mt-1">Manage freight, track progress, and collect documents</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleExportExcel}
            className="glass-button px-4 py-3 font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 flex items-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Export to Excel
          </button>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="glass-button px-6 py-3 font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 flex items-center shadow-[0_0_20px_rgba(59,130,246,0.3)]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Load
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className={`glass-panel flex flex-col p-6 overflow-hidden transition-all duration-300 ${selectedLoad ? 'w-1/2' : 'w-full'}`}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'active' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('active')}>Active Loads</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'delivered' ? 'bg-success text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('delivered')}>Delivered & Paid</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'all' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('all')}>All History</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto hide-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading freight data...</div>
            ) : filteredLoads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Package className="w-16 h-16 mb-4 opacity-50" />
                <p>No loads found for this filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredLoads.map((load) => (
                  <div 
                    key={load.id} 
                    onClick={() => setSelectedLoad(load)}
                    className={`bg-white/5 border rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition ${selectedLoad?.id === load.id ? 'border-primary bg-white/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/10'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-bold text-lg text-white">#{load.load_number}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${getStatusColor(load.status)}`}>
                            {load.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">{load.broker_name}</div>
                      </div>
                      <div className="text-xl font-bold text-success">${load.rate?.toLocaleString()}</div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-300 bg-black/30 p-3 rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-0.5">Pickup</span>
                        <span className="font-semibold">{load.pickup_location}</span>
                        <span className="text-xs text-primary">{load.pickup_date}</span>
                      </div>
                      <div className="px-4 text-gray-600">
                         <ChevronRight className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-0.5">Delivery</span>
                        <span className="font-semibold">{load.delivery_location}</span>
                        <span className="text-xs text-warning">{load.delivery_date}</span>
                      </div>
                    </div>

                    {load.users && (
                       <div className="mt-3 text-xs text-gray-400 flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          Driver: <span className="text-white ml-1 font-semibold">{load.users.first_name} {load.users.last_name}</span>
                       </div>
                    )}
                    {load.dispatcher && (
                       <div className="mt-1 text-xs text-gray-400 flex items-center">
                          <User className="w-3 h-3 mr-1 text-success" />
                          Dispatcher: <span className="text-success ml-1 font-semibold">{load.dispatcher.first_name} {load.dispatcher.last_name}</span>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedLoad && (
          <div className="glass-panel w-1/2 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="p-6 border-b border-white/10 bg-black/40 relative">
              <button onClick={() => setSelectedLoad(null)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
              
              <div className="flex justify-between items-end pr-10">
                 <div>
                   <div className="flex items-center gap-3 mb-1">
                     <div className="text-primary font-bold tracking-wider uppercase text-xs">Load Details</div>
                     <button onClick={handleDeleteLoad} className="text-xs text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded flex items-center transition">
                       <Trash2 className="w-3 h-3 mr-1" /> Delete
                     </button>
                   </div>
                   <h2 className="text-2xl font-black text-white">#{selectedLoad.load_number}</h2>
                   <p className="text-gray-400 font-medium">{selectedLoad.broker_name}</p>
                 </div>
                 <div className="text-right flex flex-col items-end">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Load Profitability</div>
                    <div className="flex justify-between w-64 mb-1 border-b border-white/10 pb-2">
                      <span className="text-gray-400">Gross Revenue</span>
                      <span className="text-success font-bold">${selectedLoad.rate?.toLocaleString()}</span>
                    </div>
                    {(() => {
                      const globalDFee = settings?.dispatcher_fee_percent !== undefined ? Number(settings.dispatcher_fee_percent) : 5;
                      const dFeePercent = selectedLoad?.dispatcher?.commission_rate != null ? Number(selectedLoad.dispatcher.commission_rate) : globalDFee;
                      const fFeePercent = settings?.factoring_fee_percent !== undefined ? Number(settings.factoring_fee_percent) : 2.5;
                      const achFee = settings?.factoring_ach_fee !== undefined ? Number(settings.factoring_ach_fee) : 5;

                      const rate = selectedLoad.rate || 0;
                      const fuel = loadFuelCost || 0;
                      const dispatchFee = rate * (dFeePercent / 100);
                      const driverPay = rate * 0.25;
                      const driverTaxes = driverPay * 0.0765;
                      const factoringFee = (rate * (fFeePercent / 100)) + achFee;
                      const maintReserve = rate * 0.05;
                      const additionalExp = selectedLoad.additional_expenses || 0;
                      const totalExpenses = dispatchFee + driverPay + driverTaxes + factoringFee + maintReserve + fuel + additionalExp;
                      const netProfit = rate - totalExpenses;

                      return (
                        <div className="w-64 text-sm mt-2">
                           <div className="flex justify-between text-warning mb-1">
                             <span>Factoring ({fFeePercent}%+${achFee}):</span>
                             <div className="text-right">
                               <span>-${factoringFee.toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-warning/70 ml-2 w-8 inline-block text-right">{((factoringFee/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between text-warning mb-1">
                             <span>Dispatch ({dFeePercent}%):</span>
                             <div className="text-right">
                               <span>-${dispatchFee.toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-warning/70 ml-2 w-8 inline-block text-right">{((dispatchFee/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between text-warning mb-1">
                             <span>Driver Pay & Taxes:</span>
                             <div className="text-right">
                               <span>-${(driverPay + driverTaxes).toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-warning/70 ml-2 w-8 inline-block text-right">{(((driverPay + driverTaxes)/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between text-blue-400 mb-1">
                             <span>Maint. Reserve (5%):</span>
                             <div className="text-right">
                               <span>-${maintReserve.toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-blue-400/70 ml-2 w-8 inline-block text-right">{((maintReserve/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between text-danger mb-1">
                             <span>Fuel Costs:</span>
                             <div className="text-right">
                               <span>-${fuel.toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-danger/70 ml-2 w-8 inline-block text-right">{((fuel/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between text-orange-400 mb-2 border-b border-white/10 pb-2">
                             <span>Unforeseen/Tolls:</span>
                             <div className="text-right">
                               <span>-${additionalExp.toFixed(2)}</span>
                               {rate > 0 && <span className="text-[10px] text-orange-400/70 ml-2 w-8 inline-block text-right">{((additionalExp/rate)*100).toFixed(1)}%</span>}
                             </div>
                           </div>
                           <div className="flex justify-between mt-1 items-end">
                             <span className="text-white font-bold uppercase text-xs tracking-wider">Net Profit</span>
                             <div className="text-right">
                               <div className={`font-black text-xl leading-none ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                  ${netProfit.toFixed(2)}
                               </div>
                               {rate > 0 && (
                                 <div className={`text-[10px] font-bold mt-1 ${netProfit >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
                                   {((netProfit / rate) * 100).toFixed(1)}% MARGIN
                                 </div>
                               )}
                             </div>
                           </div>

                           {['delivered', 'invoiced', 'paid'].includes(selectedLoad.status) && (
                             <button 
                               onClick={async () => {
                                 const exp = prompt('Enter any unforeseen expenses (Tolls, Lumpers, repairs on route, etc) in $: ', selectedLoad.additional_expenses || '0');
                                 if (exp !== null) {
                                   const val = parseFloat(exp) || 0;
                                   await supabase.from('loads').update({ additional_expenses: val }).eq('id', selectedLoad.id);
                                   fetchLoads();
                                 }
                               }}
                               className="w-full mt-4 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition"
                             >
                               Update Unforeseen Expenses
                             </button>
                           )}
                           
                           {['delivered', 'invoiced', 'paid'].includes(selectedLoad.status) && (
                             <button 
                               onClick={handleReconcileFinancials}
                               disabled={reconciling}
                               className="w-full py-3 bg-gradient-to-r from-success to-green-500 hover:from-green-600 hover:to-green-500 text-white font-black rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                             >
                               {reconciling ? 'Processing...' : 'Reconcile & Lock Financials'}
                             </button>
                           )}
                        </div>
                      )
                    })()}
                 </div>
              </div>

              <div className="mt-6 flex gap-2">
                 {selectedLoad.status === 'available' && <button onClick={() => handleUpdateStatus('dispatched')} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm transition">Dispatch Driver</button>}
                 {selectedLoad.status === 'dispatched' && <button onClick={() => handleUpdateStatus('at_pickup')} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold text-sm transition">Mark At Pickup</button>}
                 {selectedLoad.status === 'at_pickup' && <button onClick={() => handleUpdateStatus('in_transit')} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg font-bold text-sm transition">Mark Picked Up</button>}
                 {selectedLoad.status === 'in_transit' && <button onClick={() => handleUpdateStatus('at_delivery')} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold text-sm transition">Mark At Delivery</button>}
                 {selectedLoad.status === 'at_delivery' && <button onClick={() => handleUpdateStatus('delivered')} className="flex-1 bg-success hover:bg-green-500 text-white py-2 rounded-lg font-bold text-sm transition">Mark Delivered</button>}
                 {selectedLoad.status === 'delivered' && <button onClick={() => setShowInvoiceModal(true)} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold text-sm transition">Generate Invoice</button>}
                 {selectedLoad.status === 'invoiced' && <button onClick={() => handleUpdateStatus('paid')} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold text-sm transition">Mark as Paid</button>}
                 <div className={`px-4 py-2 rounded-lg font-bold text-sm border flex items-center justify-center border-white/10 bg-black/40 text-gray-300 uppercase`}>
                    Status: {selectedLoad.status.replace('_', ' ')}
                 </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-8">
              <section className="bg-white/5 p-4 rounded-xl border border-white/10">
                {selectedLoad.stops && selectedLoad.stops.length > 0 ? (
                  <div className="space-y-6">
                    {selectedLoad.stops.map((stop: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between pb-4 border-b border-white/10 last:border-0">
                        <div className="flex items-start">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 mt-1 ${stop.type === 'pickup' ? 'bg-blue-500/20 text-blue-400' : 'bg-warning/20 text-warning'}`}>
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Stop {idx + 1}: {stop.type}</div>
                            <div className="font-bold text-lg leading-tight">{stop.location}</div>
                            {stop.address && <div className="text-sm text-gray-400 mt-1">{stop.address}</div>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs uppercase font-bold ${stop.type === 'pickup' ? 'text-primary' : 'text-warning'}`}>{stop.date || 'TBD'}</div>
                          <div className={`text-[10px] uppercase font-bold mt-2 px-2 py-1 rounded inline-block ${stop.status === 'completed' ? 'bg-success/20 text-success' : stop.status === 'arrived' ? 'bg-warning/20 text-warning' : 'bg-gray-500/20 text-gray-400'}`}>
                             {stop.status || 'Pending'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between pb-4 border-b border-white/10">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mr-4 mt-1">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pickup Origin</div>
                          <div className="font-bold text-lg leading-tight">{selectedLoad.pickup_location}</div>
                          {selectedLoad.pickup_address && <div className="text-sm text-gray-400 mt-1">{selectedLoad.pickup_address}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-primary uppercase font-bold">{selectedLoad.pickup_date || 'TBD'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start justify-between pt-4">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-lg bg-warning/20 text-warning flex items-center justify-center mr-4 mt-1">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Delivery Destination</div>
                          <div className="font-bold text-lg leading-tight">{selectedLoad.delivery_location}</div>
                          {selectedLoad.delivery_address && <div className="text-sm text-gray-400 mt-1">{selectedLoad.delivery_address}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-warning uppercase font-bold">{selectedLoad.delivery_date || 'TBD'}</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10 text-center">
                   <div>
                      <div className="text-xs text-gray-500 uppercase">Broker MC</div>
                      <div className="font-semibold text-white">{selectedLoad.broker_mc || 'N/A'}</div>
                   </div>
                   <div>
                      <div className="text-xs text-gray-500 uppercase">Weight (Lbs)</div>
                      <div className="font-semibold text-white">{selectedLoad.weight ? selectedLoad.weight.toLocaleString() : 'N/A'}</div>
                   </div>
                   <div>
                      <div className="text-xs text-gray-500 uppercase">Loaded Miles</div>
                      <div className="font-semibold text-white">{selectedLoad.loaded_miles ? selectedLoad.loaded_miles.toLocaleString() : 'N/A'}</div>
                   </div>
                   <div>
                      <div className="text-xs text-warning uppercase">Deadhead Miles</div>
                      <div className="font-semibold text-warning">{selectedLoad.deadhead_miles ? selectedLoad.deadhead_miles.toLocaleString() : '0'}</div>
                   </div>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center"><User className="w-4 h-4 mr-2"/> Assigned Group</h3>
                  <button onClick={() => setShowAssignModal(true)} className="text-xs font-bold text-primary hover:text-white transition bg-primary/10 px-3 py-1.5 rounded-lg flex items-center">
                    <User className="w-3 h-3 mr-1" /> {selectedLoad.users ? 'Change Driver' : 'Assign Driver'}
                  </button>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  {selectedLoad.users ? (
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center mr-4 border border-primary/30">
                        <span className="font-bold">{selectedLoad.users.first_name[0]}{selectedLoad.users.last_name[0]}</span>
                      </div>
                      <div>
                        <div className="font-bold text-lg">{selectedLoad.users.first_name} {selectedLoad.users.last_name}</div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center">
                           <Truck className="w-3 h-3 mr-1" />
                           {selectedLoad.users.vehicles && selectedLoad.users.vehicles.length > 0 ? (
                             selectedLoad.users.vehicles.map((v:any) => v.unit_number || v.plate_number).join(' + ')
                           ) : 'No equipment'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No driver assigned to this load.</div>
                  )}
                </div>
              </section>

              {/* e-POD / Signature Section */}
              {selectedLoad.receiver_name && (
                 <section className="mb-6">
                    <h3 className="text-sm font-semibold text-success uppercase tracking-wider flex items-center mb-4">
                       <ShieldCheck className="w-4 h-4 mr-2" /> Electronic Proof of Delivery
                    </h3>
                    <div className="bg-success/10 border border-success/30 p-6 rounded-xl flex items-center justify-between">
                       <div>
                          <div className="text-xs text-success/70 uppercase font-bold tracking-wider mb-1">Signed By (Receiver)</div>
                          <div className="text-2xl font-black text-white uppercase tracking-tight">{selectedLoad.receiver_name}</div>
                          <div className="text-xs text-gray-400 mt-1">Captured securely via Driver App</div>
                       </div>
                       {selectedLoad.documents?.find((d: any) => d.doc_type === 'signature') && (
                          <div className="bg-white rounded-xl p-2 border-2 border-white/20 shadow-xl shadow-success/20">
                             <img 
                               src={selectedLoad.documents.find((d: any) => d.doc_type === 'signature').file_url} 
                               alt="Receiver Signature" 
                               className="h-20 w-40 object-contain mix-blend-multiply"
                             />
                          </div>
                       )}
                    </div>
                 </section>
              )}

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center"><FileText className="w-4 h-4 mr-2"/> Load Documents</h3>
                  <button onClick={() => setShowUploadModal(true)} className="text-xs font-bold text-primary hover:text-white transition bg-primary/10 px-3 py-1.5 rounded-lg flex items-center">
                    <Upload className="w-3 h-3 mr-1" /> Upload BOL/RC
                  </button>
                </div>
                
                {(!selectedLoad.documents || selectedLoad.documents.length === 0) ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400">
                    No documents uploaded. Upload the Rate Con, BOL, or Lumper receipts.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedLoad.documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10 hover:bg-white/5 transition">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center mr-4">
                              <FileText className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <div className="font-bold text-sm uppercase">{doc.doc_type.replace(/_/g, ' ')}</div>
                              <div className="text-xs text-gray-500 mt-1">{doc.notes || 'Document'}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => handleDeleteDocument(doc)} className="text-gray-400 hover:text-red-400 p-2 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline px-3 py-1 bg-primary/10 rounded-lg">View</a>
                          </div>
                        </div>
                    ))}
                  </div>
                )}
              </section>

              {selectedLoad.notes && (
                 <section>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Special Instructions</h3>
                    <div className="bg-warning/10 border border-warning/30 p-4 rounded-xl text-warning/90 text-sm">
                       {selectedLoad.notes}
                    </div>
                 </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Load Modal */}
      {showAddModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-3xl max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 shrink-0">
              <div>
                 <h2 className="text-2xl font-bold">Register Freight Load</h2>
                 <p className="text-sm text-gray-400 mt-1">Fill out the details or use AI to extract from PDF.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 pb-4 hide-scrollbar flex-1">
              {/* MAGIC AUTOFILL */}
              <div className="mb-8 p-4 border border-primary/40 bg-primary/10 rounded-2xl flex items-center justify-between">
               <div>
                  <h3 className="text-primary font-bold flex items-center"><Wand2 className="w-5 h-5 mr-2"/> Magic Auto-Fill</h3>
                  <p className="text-xs text-primary/70 mt-1">Upload the Rate Confirmation PDF to automatically extract the load details.</p>
               </div>
               <div>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleAutoFillUpload} accept="image/*,application/pdf" />
                  <button 
                     disabled={isParsing}
                     onClick={() => fileInputRef.current?.click()}
                     className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition disabled:opacity-50 flex items-center"
                  >
                     {isParsing ? 'Parsing...' : 'Upload RC'}
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 gap-y-6">
               <div>
                 <label className="text-xs text-gray-400 block mb-1">Load Number / Reference *</label>
                 <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary" value={formLoadNumber} onChange={e => setFormLoadNumber(e.target.value)} />
               </div>
               <div>
                 <label className="text-xs text-gray-400 block mb-1">Broker MC Number</label>
                 <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary" placeholder="e.g. 123456" value={formBrokerMC} onChange={e => setFormBrokerMC(e.target.value)} />
               </div>
               <div className="col-span-2">
                 <label className="text-xs text-gray-400 block mb-1">Select Broker (Optional)</label>
                 <select 
                   className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary mb-2 appearance-none"
                   value={formBrokerId}
                   onChange={e => {
                      setFormBrokerId(e.target.value);
                      const b = brokers.find(x => x.id === e.target.value);
                      if (b) {
                         setFormBroker(b.name);
                         setFormBrokerMC(b.mc_number);
                      }
                   }}
                 >
                   <option value="">-- Or type new broker below --</option>
                   {brokers.map(b => <option key={b.id} value={b.id}>{b.name} {b.mc_number ? `(MC: ${b.mc_number})` : ''}</option>)}
                 </select>
                 <label className="text-xs text-gray-400 block mb-1">Broker / Shipper Name *</label>
                 <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary" value={formBroker} onChange={e => { setFormBroker(e.target.value); setFormBrokerId(''); }} />
               </div>
               <div className="col-span-2">
                 <label className="text-xs text-gray-400 block mb-1">Gross Rate ($) *</label>
                 <div className="relative">
                   <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                   <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pl-10 text-white font-bold text-lg text-success focus:border-primary" placeholder="0.00" value={formRate} onChange={e => setFormRate(e.target.value)} />
                 </div>
               </div>

               <div className="col-span-2 mt-2">
                 <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                   <label className="text-xs text-primary font-bold uppercase tracking-wider">Stops / Routing *</label>
                   <button type="button" onClick={() => setFormStops([...formStops, { type: 'delivery', location: '', address: '', date: '' }])} className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition font-bold">+ Add Stop</button>
                 </div>
                 <div className="space-y-4">
                   {formStops.map((stop, idx) => (
                      <div key={idx} className="bg-black/40 border border-white/10 p-4 rounded-xl relative group">
                         {formStops.length > 2 && (
                           <button type="button" onClick={() => {
                              const newStops = [...formStops];
                              newStops.splice(idx, 1);
                              setFormStops(newStops);
                           }} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1 bg-red-500/10 rounded">
                              <X className="w-4 h-4"/>
                           </button>
                         )}
                         
                         <div className="flex flex-col sm:flex-row gap-4 items-start mb-3">
                            <div className="w-full sm:w-32 shrink-0">
                               <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Stop Type</label>
                               <select 
                                  value={stop.type} 
                                  onChange={e => {
                                     const newStops = [...formStops];
                                     newStops[idx].type = e.target.value;
                                     setFormStops(newStops);
                                  }}
                                  className={`w-full text-xs font-bold uppercase rounded-lg p-3 outline-none appearance-none cursor-pointer ${stop.type === 'pickup' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-warning/10 text-warning border-warning/30'} border`}
                               >
                                  <option value="pickup" className="bg-[#111]">Pickup</option>
                                  <option value="delivery" className="bg-[#111]">Delivery</option>
                               </select>
                            </div>
                            <div className="flex-1 w-full">
                               <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">City, State *</label>
                               <input type="text" placeholder="e.g. Houston, TX" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary" value={stop.location} onChange={e => {
                                  const newStops = [...formStops];
                                  newStops[idx].location = e.target.value;
                                  setFormStops(newStops);
                               }} />
                            </div>
                            <div className="w-full sm:w-40 shrink-0">
                               <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Date</label>
                               <input type="date" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary" value={stop.date} onChange={e => {
                                  const newStops = [...formStops];
                                  newStops[idx].date = e.target.value;
                                  setFormStops(newStops);
                               }} />
                            </div>
                         </div>
                         <div>
                            <input type="text" placeholder="Exact Address (Optional) e.g. 123 Main St, Houston, TX 77001" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-300 focus:border-primary" value={stop.address} onChange={e => {
                               const newStops = [...formStops];
                               newStops[idx].address = e.target.value;
                               setFormStops(newStops);
                            }} />
                         </div>
                         
                         {/* Ordering controls */}
                         <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-white/5">
                            {idx > 0 && (
                               <button type="button" onClick={() => {
                                  const newStops = [...formStops];
                                  const temp = newStops[idx];
                                  newStops[idx] = newStops[idx - 1];
                                  newStops[idx - 1] = temp;
                                  setFormStops(newStops);
                               }} className="text-xs text-gray-400 hover:text-white transition flex items-center bg-white/5 px-2 py-1 rounded">↑ Move Up</button>
                            )}
                            {idx < formStops.length - 1 && (
                               <button type="button" onClick={() => {
                                  const newStops = [...formStops];
                                  const temp = newStops[idx];
                                  newStops[idx] = newStops[idx + 1];
                                  newStops[idx + 1] = temp;
                                  setFormStops(newStops);
                               }} className="text-xs text-gray-400 hover:text-white transition flex items-center bg-white/5 px-2 py-1 rounded">↓ Move Down</button>
                            )}
                         </div>
                      </div>
                   ))}
                 </div>
               </div>

               <div className="col-span-1">
                  <label className="text-xs text-primary font-bold block mb-1">Assign to Dispatcher</label>
                  <select value={formDispatcherId} onChange={e => setFormDispatcherId(e.target.value)} className="w-full bg-primary/10 border border-primary/30 rounded-lg p-3 text-white font-bold focus:border-primary outline-none">
                     <option value="" className="bg-[#111]">-- Unassigned --</option>
                     {dispatchers.map(d => (
                        <option key={d.id} value={d.id} className="bg-[#111]">{d.first_name} {d.last_name}</option>
                     ))}
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-xs text-primary font-bold block mb-1">Assign to Group (Driver)</label>
                  <select value={formDriverId} onChange={e => setFormDriverId(e.target.value)} className="w-full bg-primary/10 border border-primary/30 rounded-lg p-3 text-white font-bold focus:border-primary outline-none">
                     <option value="" className="bg-[#111]">-- Available / Unassigned --</option>
                     {drivers.map(d => (
                        <option key={d.id} value={d.id} className="bg-[#111]">{d.first_name} {d.last_name}</option>
                     ))}
                  </select>
               </div>

               <div className="col-span-2">
                 <label className="text-xs text-gray-400 block mb-1">Special Notes / Instructions</label>
                 <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white min-h-[80px]" value={formNotes} onChange={e => setFormNotes(e.target.value)}></textarea>
               </div>
            </div>
            </div>

            <div className="flex justify-end mt-4 border-t border-white/10 pt-6 shrink-0">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white mr-4">Cancel</button>
              <button onClick={handleCreateLoad} className="px-10 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30">
                Register Load
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Upload Load Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                  <option value="rate_con" className="bg-[#111]">Rate Confirmation (RC)</option>
                  <option value="bol" className="bg-[#111]">Bill of Lading (BOL)</option>
                  <option value="pod" className="bg-[#111]">Proof of Delivery (POD)</option>
                  <option value="lumper" className="bg-[#111]">Lumper / Toll Receipt</option>
                  <option value="other_load_doc" className="bg-[#111]">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">File (PDF, JPG, PNG)</label>
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/5 transition cursor-pointer">
                  <input type="file" onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => setShowUploadModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button onClick={handleUploadDocument} disabled={uploading} className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30 disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Save to Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Assign Driver Modal */}
      {showAssignModal && selectedLoad && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Assign Driver</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <p className="text-gray-400 text-sm mb-6">
              Assigning a driver will automatically update their mobile app and send them an SMS notification with the load details.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Driver</label>
                <select 
                  value={assigningDriverId} 
                  onChange={e => setAssigningDriverId(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none"
                >
                  <option value="" className="bg-[#111]">-- Select Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id} className="bg-[#111]">{d.first_name} {d.last_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => setShowAssignModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button 
                onClick={handleAssignDriver} 
                disabled={!assigningDriverId}
                className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30 disabled:opacity-50"
              >
                Dispatch via SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      <InvoiceModal 
        isOpen={showInvoiceModal} 
        onClose={() => setShowInvoiceModal(false)} 
        load={selectedLoad}
        companySettings={settings}
        onMarkInvoiced={() => handleUpdateStatus('invoiced')}
      />

    </div>
  );
}
