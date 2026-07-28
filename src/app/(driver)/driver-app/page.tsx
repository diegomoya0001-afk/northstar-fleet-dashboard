"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, CheckCircle, Package, LogOut, Upload, FileText, Camera, Navigation, Clock, X, Map, ShieldCheck, Wrench, Wallet, ChevronRight } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';

const HOS_STATUSES = [
  { id: 'off_duty', label: 'Off Duty', color: 'bg-gray-500' },
  { id: 'sleeper', label: 'Sleeper Berth', color: 'bg-purple-500' },
  { id: 'driving', label: 'Driving', color: 'bg-success' },
  { id: 'on_duty', label: 'On Duty (Not Driving)', color: 'bg-warning' },
  { id: 'pc', label: 'Personal Conveyance (PC)', color: 'bg-blue-500' },
  { id: 'ym', label: 'Yard Move (YM)', color: 'bg-danger' }
];

// Helper to compress image before uploading to avoid slow uploads and iOS Safari WebKit FormData bugs.
// Returns a base64 Data URL.
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Compression timeout")), 15000);
    
    if (!file.type.startsWith('image/')) {
      clearTimeout(timeout);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          clearTimeout(timeout);
          resolve(dataUrl);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      };
      img.onerror = () => { clearTimeout(timeout); reject(new Error("Failed to load image")); };
    };
    reader.onerror = () => { clearTimeout(timeout); reject(new Error("Failed to read file")); };
  });
}

export default function DriverApp() {
  const router = useRouter();
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [activeLoads, setActiveLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropModalData, setCropModalData] = useState<{file: File, load: any, stopIndex?: number} | null>(null);

  // HOS States
  const [dutyStatus, setDutyStatus] = useState(HOS_STATUSES[0]); // Default: Off Duty
  const [showHosModal, setShowHosModal] = useState(false);
  const [hosAnnotation, setHosAnnotation] = useState('');
  const [tempDutyStatus, setTempDutyStatus] = useState(HOS_STATUSES[0]);

  // GPS Navigation States
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [navAddress, setNavAddress] = useState('');

  // Security States
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [weeklyEarnings, setWeeklyEarnings] = useState(0);

  useEffect(() => {
    // Read from localStorage (simulate login state)
    const storedId = localStorage.getItem('fleet_user_id');
    const storedRole = localStorage.getItem('fleet_user_role');
    const storedName = localStorage.getItem('fleet_user_name');

    if (!storedId || storedRole !== 'driver') {
      router.push('/login');
      return;
    }

    setDriverId(storedId);
    setDriverName(storedName || 'Driver');
    fetchActiveLoad(storedId);
    fetchLatestLog(storedId);
    fetchWeeklyEarnings(storedId);
  }, [router]);

  async function fetchWeeklyEarnings(dId: string) {
    const { data, error } = await supabase
       .from('load_financials')
       .select('*, loads!inner(assigned_driver_id)')
       .eq('status', 'reconciled')
       .eq('loads.assigned_driver_id', dId);
       
    if (!error && data) {
       const totalPay = data.reduce((acc, row) => acc + Number(row.driver_pay || 0), 0);
       setWeeklyEarnings(totalPay);
    }
  }

  async function fetchLatestLog(dId: string) {
    const { data } = await supabase
      .from('hos_logs')
      .select('*')
      .eq('driver_id', dId)
      .order('start_time', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const dbStatus = data[0].status;
      const mappedId = dbStatus.toLowerCase();
      const match = HOS_STATUSES.find(s => s.id === mappedId || s.id === dbStatus);
      if (match) setDutyStatus(match);
    }
  }

  async function fetchActiveLoad(dId: string) {
    setLoading(true);
    // Fetch ALL active assigned loads for partial dispatch
    const { data, error } = await supabase
      .from('loads')
      .select('*')
      .eq('assigned_driver_id', dId)
      .in('status', ['dispatched', 'at_pickup', 'in_transit', 'at_delivery'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setActiveLoads(data);
    } else {
      setActiveLoads([]);
    }
    setLoading(false);
  }

  const handleLogout = () => {
    localStorage.removeItem('fleet_user_id');
    localStorage.removeItem('fleet_user_role');
    localStorage.removeItem('fleet_user_name');
    router.push('/login');
  };

  const handleUpdatePin = async () => {
    if (newPin.length !== 4) {
      alert("PIN must be 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      alert("PINs do not match.");
      return;
    }
    const { error } = await supabase.from('users').update({ security_pin: newPin }).eq('id', driverId);
    if (!error) {
      alert("PIN updated successfully!");
      setShowSecurityModal(false);
      setNewPin('');
      setConfirmPin('');
    } else {
      alert("Error updating PIN: " + error.message);
    }
  };

  const handleStatusUpdate = async (loadId: string, newStatus: string) => {
    const { error } = await supabase.from('loads').update({ status: newStatus }).eq('id', loadId);
    if (!error) {
      fetchActiveLoad(driverId);
    } else {
      alert("Error updating status: " + error.message);
    }
  };

  const handleStopUpdate = async (loadId: string, stops: any[], stopIndex: number, newStopStatus: string) => {
    const updatedStops = [...stops];
    updatedStops[stopIndex].status = newStopStatus;
    
    // Auto-advance load status based on stops progress
    let newLoadStatus = undefined;
    const allCompleted = updatedStops.every(s => s.status === 'completed');
    if (allCompleted) {
       newLoadStatus = 'delivered';
    } else if (newStopStatus === 'arrived' && updatedStops[stopIndex].type === 'pickup') {
       newLoadStatus = 'at_pickup';
    } else if (newStopStatus === 'completed' && updatedStops[stopIndex].type === 'pickup') {
       newLoadStatus = 'in_transit';
    } else if (newStopStatus === 'arrived' && updatedStops[stopIndex].type === 'delivery') {
       newLoadStatus = 'at_delivery';
    }

    const updates: any = { stops: updatedStops };
    if (newLoadStatus) updates.status = newLoadStatus;

    const { error } = await supabase.from('loads').update(updates).eq('id', loadId);
    if (!error) {
      fetchActiveLoad(driverId);
    } else {
      alert("Error updating stop: " + error.message);
    }
  };

  const processAndUploadFile = async (file: File | Blob, load: any, stopIndex?: number, originalName?: string) => {
    setUploading(true);
    setCropModalData(null);
    
    try {
      let finalFile: File;
      if (file instanceof File && file.type.startsWith('image/')) {
         const base64DataUrl = await compressImage(file);
         const arr = base64DataUrl.split(',');
         const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
         const bstr = atob(arr[1]);
         let n = bstr.length;
         const u8arr = new Uint8Array(n);
         while(n--){
             u8arr[n] = bstr.charCodeAt(n);
         }
         finalFile = new File([u8arr], file.name, {type: mime});
      } else if (file instanceof Blob && !(file instanceof File)) {
         finalFile = new File([file], originalName || 'cropped.jpg', {type: file.type});
      } else {
         finalFile = file as File;
      }

      const fileExt = finalFile.name.split('.').pop() || 'jpg';
      const fileName = `load-${load.id}-${Date.now()}.${fileExt}`;
      const filePath = `loads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, finalFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('documents').insert([{
        entity_type: 'load',
        entity_id: load.id,
        doc_type: 'pod',
        file_url: publicUrl,
        notes: "Driver Uploaded POD"
      }]);

      if (dbError) throw dbError;

      alert("POD successfully uploaded!");
      if (stopIndex !== undefined && load.stops) {
         await handleStopUpdate(load.id, load.stops, stopIndex, 'completed');
      } else if (load.status === 'at_delivery') {
         await handleStatusUpdate(load.id, 'delivered');
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Failed to upload document";
      if (msg === "Load failed" || msg.includes("NetworkError") || msg.includes("fetch")) {
        msg = "Internet connection dropped. The photo couldn't be sent. Please try again when you have better signal.";
      }
      alert("Upload error: " + msg);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, load: any, stopIndex?: number) => {
    const target = e.target;
    const file = target.files?.[0];
    if (!file || !load) return;

    if (file.type.startsWith('image/')) {
       setCropModalData({ file, load, stopIndex });
       target.value = '';
       return;
    }
    
    await processAndUploadFile(file, load, stopIndex);
    target.value = '';
  };

  const handleOpenNav = (address: string) => {
    setNavAddress(address);
    setShowGpsModal(true);
  };

  const getNavUrl = (app: string, address: string) => {
    const encoded = encodeURIComponent(address);
    switch(app) {
      case 'google': return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      case 'waze': return `https://waze.com/ul?q=${encoded}&navigate=yes`;
      case 'apple': return `http://maps.apple.com/?daddr=${encoded}`;
      case 'sygic': return `com.sygic.aura://search|${encoded}|drive`;
      case 'hammer': return `https://hammerapp.com/app/route/current-location/${encoded}`;
      case 'truckerpath': return `truckerpath://`; // TruckerPath requires lat/lng, falling back to app launch
      default: return '#';
    }
  };

  const handleUpdateHos = async () => {
    setDutyStatus(tempDutyStatus);
    setShowHosModal(false);
    
    // Save to the 'hos_logs' table in Supabase so it syncs with the Logs page
    const now = new Date().toISOString();
    
    // Attempt to close previous active log if needed
    const { data: activeLogs } = await supabase
      .from('hos_logs')
      .select('id')
      .eq('driver_id', driverId)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1);

    if (activeLogs && activeLogs.length > 0) {
      await supabase.from('hos_logs').update({ end_time: now }).eq('id', activeLogs[0].id);
    }

    // Insert new log
    const dbStatus = tempDutyStatus.id.toUpperCase(); // Ensure it matches hos-logs (e.g. 'ON_DUTY')
    await supabase.from('hos_logs').insert([{
      driver_id: driverId,
      status: dbStatus,
      start_time: now,
      location_lat: null, // Driver-app doesn't pull GPS for this quick update yet
      location_lng: null
    }]);

    setHosAnnotation('');
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading your assignment...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] relative">
      {/* Driver Header */}
      <header className="bg-[#111] p-6 pt-16 pb-8 rounded-b-[40px] shadow-lg relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
             <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                <Truck className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Driver Portal</p>
                <h1 className="text-xl font-black text-white">{driverName}</h1>
             </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setShowSecurityModal(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition" title="Security Settings">
              <ShieldCheck className="w-5 h-5 text-gray-400" />
            </button>
            <button onClick={handleLogout} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition" title="Logout">
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Duty Status (Full Width) */}
        <button 
           onClick={() => {
              setTempDutyStatus(dutyStatus);
              setShowHosModal(true);
           }}
           className="w-full bg-black/50 hover:bg-black border border-white/5 p-4 rounded-2xl flex items-center justify-between transition cursor-pointer mb-3"
        >
           <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> Duty Status</p>
              <div className="flex items-center">
                 <div className={`w-3 h-3 ${dutyStatus.color} rounded-full animate-pulse mr-2`}></div>
                 <span className={`font-bold ${dutyStatus.color.replace('bg-', 'text-')} text-sm uppercase tracking-wider`}>{dutyStatus.label}</span>
              </div>
           </div>
           <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Active Loads</p>
              <span className="font-bold text-white text-sm">{activeLoads.length > 0 ? activeLoads.length : 'None'}</span>
           </div>
        </button>

        {/* 3 Compact Widgets in a row */}
        <div className="flex bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden divide-x divide-white/5">
          {/* Roadside Inspection Button */}
          <button 
            onClick={() => router.push('/documents')}
            className="flex-1 hover:bg-white/5 p-3 flex flex-col items-center justify-center transition cursor-pointer text-center h-16"
          >
            <ShieldCheck className="w-5 h-5 text-danger mb-1" />
            <h3 className="font-bold text-white text-[9px] uppercase tracking-wider leading-tight">Inspection</h3>
          </button>

          {/* Report Repair Button */}
          <button 
            onClick={() => router.push('/repairs')}
            className="flex-1 hover:bg-white/5 p-3 flex flex-col items-center justify-center transition cursor-pointer text-center h-16"
          >
            <Wrench className="w-5 h-5 text-warning mb-1" />
            <h3 className="font-bold text-white text-[9px] uppercase tracking-wider leading-tight">Shop/Repair</h3>
          </button>

          {/* Weekly Production Widget */}
          <button 
            onClick={() => router.push('/earnings')}
            className="flex-1 hover:bg-white/5 p-3 flex flex-col items-center justify-center transition cursor-pointer text-center h-16"
          >
            <Wallet className="w-5 h-5 text-success mb-1" />
            <h3 className="font-black text-white text-[11px] leading-tight">${weeklyEarnings.toFixed(0)}</h3>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 -mt-4 relative z-0 pb-20">
        <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
        {activeLoads.length > 0 ? (
           activeLoads.map((load) => (
             <div key={load.id} className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                   <h2 className="text-lg font-black flex items-center">
                     <Package className="w-5 h-5 mr-2 text-primary" /> Load #{load.load_number}
                   </h2>
                   <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                     {load.status.replace('_', ' ')}
                   </span>
                </div>

                {/* Itinerary / Route Timeline */}
                {load.stops && load.stops.length > 0 ? (
                  <div className="relative pl-6 space-y-10 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-6 before:w-0.5 before:bg-white/10">
                    {load.stops.map((stop: any, idx: number) => {
                       const isPreviousCompleted = idx === 0 || load.stops[idx - 1].status === 'completed';
                       const isCompleted = stop.status === 'completed';
                       const isOpacity50 = !isPreviousCompleted || isCompleted;

                       return (
                         <div key={idx} className={`relative transition-opacity ${isOpacity50 ? 'opacity-50' : 'opacity-100'}`}>
                            <div className="absolute -left-[27px] bg-[#1a1a1a] p-1 rounded-full">
                               <div className={`w-4 h-4 rounded-full ring-4 ${stop.type === 'pickup' ? (isCompleted ? 'bg-success ring-success/20' : 'bg-primary ring-primary/20') : (isCompleted ? 'bg-success ring-success/20' : stop.status === 'arrived' ? 'bg-warning ring-warning/20' : 'bg-gray-500 ring-gray-500/20')}`}></div>
                            </div>
                            <div className="mb-1 flex justify-between items-end">
                               <span className={`text-xs font-bold uppercase ${stop.type === 'pickup' ? 'text-primary' : 'text-warning'}`}>Stop {idx + 1}: {stop.type}</span>
                               <span className="text-xs text-gray-400 font-medium">{stop.date}</span>
                            </div>
                            <h3 className="text-xl font-bold leading-tight mb-1">{stop.location}</h3>
                            <p className="text-sm text-gray-400 mb-3">{stop.address}</p>

                            <div className="space-y-2">
                               <button onClick={() => handleOpenNav(stop.address || stop.location)} className={`w-full py-2 bg-${stop.type === 'pickup' ? 'primary' : 'warning'}/10 text-${stop.type === 'pickup' ? 'primary' : 'warning'} border border-${stop.type === 'pickup' ? 'primary' : 'warning'}/20 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-${stop.type === 'pickup' ? 'primary' : 'warning'}/20 transition`}>
                                  <Navigation className="w-4 h-4 mr-2" /> Navigate
                               </button>

                               {!isCompleted && isPreviousCompleted && (!stop.status || stop.status === 'pending') && (
                                 <button onClick={() => handleStopUpdate(load.id, load.stops, idx, 'arrived')} className={`w-full py-3 ${stop.type === 'pickup' ? 'bg-primary hover:bg-blue-600 text-white' : 'bg-warning hover:bg-yellow-600 text-black'} font-bold rounded-xl shadow-lg transition active:scale-[0.98]`}>
                                    Confirm Arrival
                                 </button>
                               )}

                               {!isCompleted && isPreviousCompleted && stop.status === 'arrived' && stop.type === 'pickup' && (
                                 <button onClick={() => handleStopUpdate(load.id, load.stops, idx, 'completed')} className="w-full py-3 bg-success hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition active:scale-[0.98]">
                                    Mark Loaded & Depart
                                 </button>
                               )}

                               {!isCompleted && isPreviousCompleted && stop.status === 'arrived' && stop.type === 'delivery' && (
                                 <div className="pt-2 border-t border-white/5 mt-2">
                                    <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" ref={fileInputRef} onChange={(e) => handleUploadDocument(e, load, idx)} />
                                    <button disabled={uploading} onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-success hover:bg-green-500 text-white font-black text-lg rounded-xl shadow-lg shadow-green-500/20 transition active:scale-[0.98] flex items-center justify-center disabled:opacity-50">
                                       {uploading ? 'Uploading...' : <><Camera className="w-6 h-6 mr-2" /> Upload POD to Complete</>}
                                    </button>
                                    <p className="text-center text-xs text-gray-500 mt-2 flex items-center justify-center">
                                       <CheckCircle className="w-3 h-3 mr-1 text-danger" /> Mandatory to complete delivery.
                                    </p>
                                 </div>
                               )}
                            </div>
                         </div>
                       );
                    })}
                  </div>
                ) : (
                <div className="relative pl-6 space-y-10 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-6 before:w-0.5 before:bg-white/10">
                   {/* Pickup Stop */}
                   <div className={`relative transition-opacity ${['in_transit', 'at_delivery', 'delivered'].includes(load.status) ? 'opacity-50' : 'opacity-100'}`}>
                      <div className="absolute -left-[27px] bg-[#1a1a1a] p-1 rounded-full">
                         <div className={`w-4 h-4 rounded-full ring-4 ${['dispatched', 'at_pickup'].includes(load.status) ? 'bg-primary ring-primary/20' : 'bg-success ring-success/20'}`}></div>
                      </div>
                      <div className="mb-1 flex justify-between items-end">
                         <span className="text-xs font-bold uppercase text-primary">Stop 1: Pickup</span>
                         <span className="text-xs text-gray-400 font-medium">{load.pickup_date}</span>
                      </div>
                      <h3 className="text-xl font-bold leading-tight mb-1">{load.pickup_location}</h3>
                      <p className="text-sm text-gray-400 mb-3">{load.pickup_address}</p>
                      
                      <div className="space-y-2">
                        <button onClick={() => handleOpenNav(load.pickup_address || load.pickup_location)} className="w-full py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-primary/20 transition">
                           <Navigation className="w-4 h-4 mr-2" /> Navigate
                        </button>
                        
                        {load.status === 'dispatched' && (
                          <button onClick={() => handleStatusUpdate(load.id, 'at_pickup')} className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg transition active:scale-[0.98]">
                             Confirm Arrival at Pickup
                          </button>
                        )}
                        {load.status === 'at_pickup' && (
                          <button onClick={() => handleStatusUpdate(load.id, 'in_transit')} className="w-full py-3 bg-success hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition active:scale-[0.98]">
                             Mark Loaded & Depart
                          </button>
                        )}
                      </div>
                   </div>

                   {/* Delivery Stop */}
                   <div className={`relative transition-opacity ${['dispatched', 'at_pickup'].includes(load.status) ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                      <div className="absolute -left-[27px] bg-[#1a1a1a] p-1 rounded-full">
                         <div className={`w-4 h-4 rounded-full ring-4 ${['in_transit', 'at_delivery'].includes(load.status) ? 'bg-warning ring-warning/20' : 'bg-gray-500 ring-gray-500/20'}`}></div>
                      </div>
                      <div className="mb-1 flex justify-between items-end">
                         <span className="text-xs font-bold uppercase text-warning">Stop 2: Delivery</span>
                         <span className="text-xs text-gray-400 font-medium">{load.delivery_date}</span>
                      </div>
                      <h3 className="text-xl font-bold leading-tight mb-1">{load.delivery_location}</h3>
                      <p className="text-sm text-gray-400 mb-3">{load.delivery_address}</p>
                      
                      <div className="space-y-2">
                        <button onClick={() => handleOpenNav(load.delivery_address || load.delivery_location)} className="w-full py-2 bg-warning/10 text-warning border border-warning/20 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-warning/20 transition">
                           <Navigation className="w-4 h-4 mr-2" /> Navigate
                        </button>

                        {load.status === 'in_transit' && (
                          <button onClick={() => handleStatusUpdate(load.id, 'at_delivery')} className="w-full py-3 bg-warning hover:bg-yellow-600 text-black font-bold rounded-xl shadow-lg transition active:scale-[0.98]">
                             Confirm Arrival at Delivery
                          </button>
                        )}
                        
                        {load.status === 'at_delivery' && (
                          <div className="pt-2 border-t border-white/5 mt-2">
                             <input 
                                type="file" 
                                accept="image/*,application/pdf" 
                                capture="environment" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={(e) => handleUploadDocument(e, load)} 
                             />
                             <button 
                                disabled={uploading}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 bg-success hover:bg-green-500 text-white font-black text-lg rounded-xl shadow-lg shadow-green-500/20 transition active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
                             >
                                {uploading ? 'Uploading...' : <><Camera className="w-6 h-6 mr-2" /> Upload POD to Complete</>}
                             </button>
                             <p className="text-center text-xs text-gray-500 mt-2 flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 mr-1 text-danger" /> Mandatory to mark as delivered.
                             </p>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
                )}

                {/* Load Info */}
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-6">
                   <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Weight</div>
                      <div className="font-bold">{load.weight?.toLocaleString() || '---'} LBS</div>
                   </div>
                   <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Miles</div>
                      <div className="font-bold">{load.loaded_miles?.toLocaleString() || '---'} MI</div>
                   </div>
                </div>

                {load.notes && (
                   <div className="mt-4 bg-warning/10 border border-warning/20 p-4 rounded-2xl">
                      <div className="text-xs text-warning font-bold uppercase mb-1">Special Instructions</div>
                      <p className="text-sm text-warning/90 leading-snug">{load.notes}</p>
                   </div>
                )}
             </div>
           ))
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-center p-6 mt-10 col-span-full">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                 <Truck className="w-10 h-10 text-gray-500" />
              </div>
              <h2 className="text-2xl font-black mb-2 text-white/80">No Active Loads</h2>
              <p className="text-gray-500">You don't have any loads dispatched to you right now. Stand by for instructions.</p>
           </div>
        )}
        </div>
      </div>

      {/* HOS MODAL */}
      {showHosModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center"><Clock className="w-5 h-5 mr-2 text-primary" /> Update Duty Status</h2>
              <button onClick={() => setShowHosModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
               {HOS_STATUSES.map(status => (
                  <button 
                     key={status.id}
                     onClick={() => setTempDutyStatus(status)}
                     className={`p-3 rounded-xl border flex flex-col items-start transition-all ${
                        tempDutyStatus.id === status.id 
                        ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                     }`}
                  >
                     <div className={`w-3 h-3 ${status.color} rounded-full mb-2`}></div>
                     <span className="text-xs font-bold text-left">{status.label}</span>
                  </button>
               ))}
            </div>

            <div className="mb-6">
               <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Mandatory Remark / Annotation:</label>
               <input 
                  type="text" 
                  placeholder="e.g. Pre-trip inspection, Fueling, Traffic..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={hosAnnotation}
                  onChange={e => setHosAnnotation(e.target.value)}
               />
               <p className="text-[10px] text-gray-500 mt-2 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-danger" /> Location will be recorded automatically via GPS.
               </p>
            </div>

            <div className="flex gap-3">
               <button onClick={() => setShowHosModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition">Cancel</button>
               <button onClick={handleUpdateHos} className="flex-[2] py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition">Save & Update Log</button>
            </div>
          </div>
        </div>
      )}

      {/* GPS MODAL */}
      {showGpsModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end">
           <div className="bg-[#1a1a1a] border-t border-white/10 rounded-t-[40px] p-6 pb-10 animate-in slide-in-from-bottom-full duration-300 max-h-[85vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
              <h3 className="text-center font-bold text-lg mb-6">Choose Navigation App</h3>
              
              <div className="space-y-3">
                 <a href={getNavUrl('google', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-4 p-2">
                       <Map className="w-6 h-6 text-blue-500" />
                    </div>
                    <span className="font-bold text-lg">Google Maps</span>
                 </a>
                 
                 <a href={getNavUrl('waze', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-[#33ccff] rounded-full flex items-center justify-center mr-4">
                       <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-lg">Waze</span>
                 </a>
                 
                 <a href={getNavUrl('apple', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-black border border-white/20 rounded-full flex items-center justify-center mr-4">
                       <Navigation className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg">Apple Maps</span>
                 </a>

                 <a href={getNavUrl('sygic', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full flex items-center justify-center mr-4">
                       <Navigation className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg">Sygic Truck Navigation</span>
                 </a>

                 <a href={getNavUrl('truckerpath', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-[#0A3D69] rounded-full flex items-center justify-center mr-4">
                       <Truck className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg">Trucker Path</span>
                 </a>

                 <a href={getNavUrl('hammer', navAddress)} target="_blank" rel="noreferrer" onClick={() => setShowGpsModal(false)} className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                       <Truck className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg">Hammer App</span>
                 </a>
              </div>

              <button onClick={() => setShowGpsModal(false)} className="w-full mt-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition">Cancel</button>
           </div>
        </div>
      )}
      {/* SECURITY MODAL */}
      {showSecurityModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSecurityModal(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <ShieldCheck className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Security Settings</h2>
              <p className="text-sm text-gray-500 mb-6">Device securely linked to {driverName}. Admin PIN is required to unlink or change settings.</p>
              
              <button 
                onClick={() => {
                   setShowSecurityModal(false);
                   alert("Admin PIN configuration is managed from the main Admin Dashboard.");
                }} 
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl mb-3 transition"
              >
                 Change Admin PIN
              </button>
              <button 
                onClick={() => setShowSecurityModal(false)} 
                className="w-full py-3 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 font-bold rounded-xl transition"
              >
                 Unlink Device (Logout)
              </button>
            </div>
          </div>
        </div>
      )}

      {cropModalData && (
        <ImageCropper
          imageFile={cropModalData.file}
          onCancel={() => setCropModalData(null)}
          onCropComplete={(croppedBlob, originalName) => {
            processAndUploadFile(croppedBlob, cropModalData.load, cropModalData.stopIndex, originalName);
          }}
        />
      )}
    </div>
  );
}
