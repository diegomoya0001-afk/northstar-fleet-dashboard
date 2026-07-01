"use client";

import React, { useState, useEffect, useRef } from "react";
import { Droplet, Plus, X, Upload, Camera, AlertCircle, FileText, MapPin, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const COMMON_GAS_STATIONS = [
  "Pilot",
  "Flying J",
  "Love's Travel Stops",
  "TA (TravelCenters of America)",
  "Petro Stopping Centers",
  "Chevron",
  "Shell",
  "Exxon",
  "Mobil",
  "Mobil",
  "Buc-ee's",
  "Other"
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Helper to compress image before uploading to avoid 4.5MB Next.js limit and slow uploads
// Returns a base64 Data URL to completely avoid iOS Safari WebKit FormData bugs.
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Increase timeout to 15 seconds. Old iPhones take a while to compress 10MB images.
    const timeout = setTimeout(() => reject(new Error("Compression timeout")), 15000);
    
    if (!file.type.startsWith('image/')) {
      clearTimeout(timeout);
      // For PDFs or non-images, just read as base64
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
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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

export default function FuelModule() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  // Form states
  const [odometer, setOdometer] = useState("");
  const [gallons, setGallons] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [station, setStation] = useState(COMMON_GAS_STATIONS[0]);
  const [customStation, setCustomStation] = useState("");
  const [fuelType, setFuelType] = useState("Diesel");
  const [fuelState, setFuelState] = useState("TX");
  const [refuelDate, setRefuelDate] = useState(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
  });
  const [refuelTime, setRefuelTime] = useState(() => {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [ocrError, setOcrError] = useState("");

  const driverId = typeof window !== 'undefined' ? localStorage.getItem('fleet_user_id') : null;

  useEffect(() => {
    if (driverId) {
      fetchLogs();
    } else {
      router.push('/login');
    }
  }, [driverId, router]);

  // Auto-calculate total cost if gallons and price are entered
  useEffect(() => {
    if (gallons && pricePerGallon) {
      const g = parseFloat(gallons);
      const p = parseFloat(pricePerGallon);
      if (!isNaN(g) && !isNaN(p)) {
        setTotalCost((g * p).toFixed(2));
      }
    }
  }, [gallons, pricePerGallon]);

  async function fetchLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fuel_logs')
      .select('*')
      .eq('driver_id', driverId)
      .order('odometer', { ascending: false });
    
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

  async function handleSaveFuel() {
    if (!odometer || !gallons || !totalCost || (!receiptFile)) {
      alert("Please fill all required fields and upload a receipt.");
      return;
    }

    setUploading(true);
    try {
      const finalStation = station === "Other" ? customStation : station;
      
      // 1. Get active load (if any)
      const { data: loadData } = await supabase
        .from('loads')
        .select('id')
        .eq('assigned_driver_id', driverId)
        .in('status', ['dispatched', 'at_pickup', 'in_transit', 'at_delivery'])
        .limit(1)
        .single();
      
      const loadId = loadData ? loadData.id : null;

      // 2. Get assigned vehicle
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('assigned_driver_id', driverId)
        .eq('type', 'truck')
        .limit(1)
        .single();
      
      const vehicleId = vehicleData ? vehicleData.id : null;

      // 3. Upload receipt
      let receiptUrl = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const date = new Date();
        const folder = `receipts/${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}`;
        const fileName = `${driverId}-${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
        receiptUrl = publicUrl;
      }

      // 4. Insert fuel log
      const { error: insertError } = await supabase
        .from('fuel_logs')
        .insert([{
          driver_id: driverId,
          vehicle_id: vehicleId,
          load_id: loadId,
          odometer: parseFloat(odometer),
          gallons: parseFloat(gallons),
          price_per_gallon: parseFloat(pricePerGallon || "0"),
          total_cost: parseFloat(totalCost),
          gas_station: finalStation,
          fuel_type: fuelType,
          refuel_date: refuelDate,
          refuel_time: refuelTime,
          state: fuelState,
          receipt_url: receiptUrl
        }]);

      if (insertError) throw insertError;

      // Reset and reload
      setShowModal(false);
      setOdometer("");
      setGallons("");
      setPricePerGallon("");
      setTotalCost("");
      setStation(COMMON_GAS_STATIONS[0]);
      setCustomStation("");
      setFuelType("Diesel");
      setFuelState("TX");
      setReceiptFile(null);
      fetchLogs();
      
    } catch (err: any) {
      alert("Error saving fuel log: " + err.message);
    }
    setUploading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const originalFile = e.target.files ? e.target.files[0] : null;
    setOcrError("");
    if (!originalFile) {
      setReceiptFile(null);
      return;
    }

    // Set the initial file just for visual feedback immediately
    setReceiptFile(originalFile);

    // Trigger AI parsing & compression
    setParsingReceipt(true);
    try {
      // Compress the image into a base64 Data URL
      const base64DataUrl = await compressImage(originalFile);
      
      // Convert base64 back to a File for the final Supabase upload (reduces size from 5MB -> 50KB)
      const arr = base64DataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--){
          u8arr[n] = bstr.charCodeAt(n);
      }
      const compressedFile = new File([u8arr], originalFile.name, {type: mime});
      setReceiptFile(compressedFile);
      
      // Calculate approximate size in bytes from base64 string
      const sizeInBytes = Math.round((base64DataUrl.length * 3) / 4);
      if (sizeInBytes > 4.2 * 1024 * 1024) {
         setOcrError("The photo is too large to process. Please take a photo from further away or lower your camera resolution.");
         setParsingReceipt(false);
         return;
      }

      // Send as JSON instead of FormData to bypass iOS WebKit bugs entirely
      const response = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: base64DataUrl,
          mimeType: originalFile.type.startsWith('image/') ? 'image/jpeg' : originalFile.type
        })
      });
      
      if (!response.ok) {
         let errMsg = "Failed to parse receipt";
         try {
           const errData = await response.json();
           if (errData.error) errMsg = errData.error;
         } catch(e) {
           errMsg = "Server error (status " + response.status + "). Image might be too large.";
         }
         throw new Error(errMsg);
      }
      
      const data = await response.json();
      if (data.gallons) setGallons(data.gallons);
      if (data.pricePerGallon) setPricePerGallon(data.pricePerGallon);
      if (data.totalCost) setTotalCost(data.totalCost);
      if (data.state) setFuelState(data.state);
        
        if (data.gasStation) {
          // Check if it's in our common list
          const matchedStation = COMMON_GAS_STATIONS.find(s => 
            s.toLowerCase().includes(data.gasStation.toLowerCase()) || 
            data.gasStation.toLowerCase().includes(s.toLowerCase())
          );
          
          if (matchedStation && matchedStation !== "Other") {
            setStation(matchedStation);
          } else {
            setStation("Other");
            setCustomStation(data.gasStation);
          }
        }
    } catch (err: any) {
      console.error("OCR Failed:", err);
      let msg = err.message || "Failed to process receipt";
      if (msg === "Load failed" || msg.includes("NetworkError") || msg.includes("fetch")) {
        msg = "Internet connection dropped. The photo couldn't be sent. Please try again when you have better signal.";
      }
      setOcrError(msg);
    } finally {
      setParsingReceipt(false);
    }
  }

  // Calculate MPG dynamically based on the list (sorted by odometer descending)
  const getLogWithMPG = () => {
    return logs.map((log, index) => {
      let mpg = null;
      let distance = null;
      let costPerMile = null;
      
      if (log.fuel_type === 'Diesel' || !log.fuel_type) {
        // Find the next chronologically previous log for the SAME vehicle and SAME fuel type
        const prevLogIndex = logs.findIndex((l, i) => 
          i > index && 
          l.vehicle_id === log.vehicle_id && 
          (l.fuel_type === 'Diesel' || !l.fuel_type)
        );
        
        if (prevLogIndex !== -1) {
          const prevLog = logs[prevLogIndex];
          distance = log.odometer - prevLog.odometer;
          if (distance > 0) {
            if (log.gallons > 0) {
              mpg = (distance / log.gallons).toFixed(2);
            }
            if (log.total_cost > 0) {
              costPerMile = (log.total_cost / distance).toFixed(3);
            }
          }
        }
      }
      return { ...log, mpg, distance, costPerMile };
    });
  };

  const logsWithMPG = getLogWithMPG();

  return (
    <div className="flex flex-col min-h-screen bg-[#000] text-white">
      {/* Header */}
      <header className="bg-[#111] p-6 pt-20 pb-8 rounded-b-[40px] shadow-2xl relative z-10 border-b border-white/5">
        <div className="flex justify-between items-center mb-2">
           <h1 className="text-2xl font-black text-white flex items-center">
              <Droplet className="w-6 h-6 mr-3 text-primary" /> Mileage Log
           </h1>
        </div>
        <p className="text-gray-400 text-sm mt-3 font-medium">Track your fuel consumption and costs</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
         {loading ? (
           <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
           </div>
         ) : logs.length === 0 ? (
           <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                 <Droplet className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">No Fuel Records</h3>
              <p className="text-gray-400 text-sm">Add your first fuel receipt to start tracking MPG and expenses.</p>
           </div>
         ) : (
           <div className="space-y-4">
              {logsWithMPG.map((log) => {
                 const date = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                 return (
                   <div key={log.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:bg-white/5 transition">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mr-3">
                             <Droplet className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{date}</h3>
                            <p className="text-xl font-black text-white">${Number(log.total_cost).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{Number(log.odometer).toLocaleString()} mi</p>
                          {log.distance && <p className="text-gray-400 text-sm">{log.distance.toLocaleString()} mi</p>}
                          {log.load_id && <span className="text-[10px] uppercase font-bold text-success bg-success/20 px-2 py-0.5 rounded mt-1 inline-block">Active Load</span>}
                        </div>
                      </div>

                      <div className="bg-black/50 rounded-xl p-3 space-y-2 text-sm border border-white/5">
                        <div className="flex items-center text-gray-300">
                          <Droplet className="w-4 h-4 mr-2 text-purple-400" />
                          <span>{Number(log.gallons).toFixed(3)} gal ({log.fuel_type || 'Diesel'}) &rarr; ${Number(log.price_per_gallon).toFixed(3)}/gal</span>
                        </div>
                        {(log.mpg || log.costPerMile) && (
                          <div className="flex items-center space-x-4">
                            {log.mpg && (
                              <div className="flex items-center">
                                <TrendingUp className="w-4 h-4 mr-2 text-success" />
                                <span className="text-success font-bold">{log.mpg} mpg</span>
                              </div>
                            )}
                            {log.costPerMile && (
                              <div className="flex items-center text-gray-400">
                                <span className="w-4 h-4 mr-1 text-center font-bold text-xs bg-gray-700 text-white rounded-full flex items-center justify-center">$</span>
                                <span>${log.costPerMile}/mi</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center text-gray-400">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span>{log.gas_station}</span>
                        </div>
                      </div>

                      {log.receipt_url && (
                        <a href={log.receipt_url} target="_blank" rel="noreferrer" className="absolute top-5 right-16 text-gray-500 hover:text-primary transition p-2 bg-white/5 rounded-full">
                          <FileText className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(log.id)} className="absolute top-5 right-5 text-gray-500 hover:text-danger transition p-2 bg-white/5 rounded-full">
                         <X className="w-4 h-4" />
                      </button>
                   </div>
                 );
              })}
           </div>
         )}
      </main>

      {/* FAB for Adding Fuel */}
      <div className="fixed bottom-24 right-6 z-40 animate-in zoom-in duration-300">
        <button onClick={() => setShowModal(true)} className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-95 transition">
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* Add Fuel Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300">
          <div className="flex justify-between items-center p-6 pt-12 border-b border-white/10 bg-[#111]">
            <h2 className="text-xl font-bold">Add Fuel Record</h2>
            <button onClick={() => setShowModal(false)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-32">
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Date *</label>
                    <input type="date" value={refuelDate} onChange={e => setRefuelDate(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base font-bold outline-none focus:border-primary transition" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Time *</label>
                    <input type="time" value={refuelTime} onChange={e => setRefuelTime(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base font-bold outline-none focus:border-primary transition" />
                 </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Odometer (mi) *</label>
                  <input type="text" inputMode="numeric" value={odometer ? Number(odometer).toLocaleString() : ''} onChange={e => setOdometer(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-lg font-bold outline-none focus:border-primary transition" placeholder="e.g. 150,000" />
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fuel Type *</label>
                  <select value={fuelType} onChange={e => setFuelType(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base font-bold outline-none focus:border-primary transition">
                    <option value="Diesel">Diesel (Tractor)</option>
                    <option value="Reefer">Diesel (Reefer)</option>
                    <option value="DEF">DEF</option>
                    <option value="Gas">Gasoline</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gas (gal) *</label>
                    <input type="number" step="0.001" value={gallons} onChange={e => setGallons(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-lg font-bold outline-none focus:border-primary transition" placeholder="e.g. 50.5" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Price/gal</label>
                    <input type="number" step="0.001" value={pricePerGallon} onChange={e => setPricePerGallon(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-lg font-bold outline-none focus:border-primary transition" placeholder="$3.50" />
                 </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-primary uppercase mb-1 block">Total Cost ($) *</label>
                  <input type="number" step="0.01" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 text-lg font-bold text-primary outline-none focus:border-primary transition" placeholder="$150.00" />
               </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gas Station *</label>
                    <select value={station} onChange={e => setStation(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-primary transition">
                      {COMMON_GAS_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">State *</label>
                    <select value={fuelState} onChange={e => setFuelState(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-primary transition">
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
               </div>

               {station === "Other" && (
                 <div className="animate-in fade-in zoom-in-95">
                    <label className="text-xs font-bold text-primary uppercase mb-1 block">Station Name *</label>
                    <input type="text" value={customStation} onChange={e => setCustomStation(e.target.value)} className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 text-base outline-none focus:border-primary transition" placeholder="Enter gas station name" />
                 </div>
               )}
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
               <label className="text-xs font-bold text-gray-400 uppercase mb-3 block flex justify-between items-center">
                 <span>Receipt Photo *</span>
                 {parsingReceipt && <span className="text-primary text-[10px] animate-pulse flex items-center"><div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin mr-1"></div> Reading Receipt...</span>}
               </label>
               {receiptFile ? (
                 <div className="bg-[#000] p-4 rounded-xl border border-white/10 flex items-center justify-between">
                    <div className="flex items-center overflow-hidden">
                       <FileText className="w-6 h-6 text-primary mr-3 shrink-0" />
                       <span className="text-sm truncate">{receiptFile.name}</span>
                    </div>
                    <button onClick={() => setReceiptFile(null)} className="text-danger ml-2 p-2">
                      <X className="w-4 h-4" />
                    </button>
                 </div>
               ) : (
                 <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 hover:border-primary/50 transition hover:bg-white/5 rounded-xl cursor-pointer relative overflow-hidden">
                    <Camera className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-sm font-bold text-primary">Take Photo or Upload</span>
                    <span className="text-xs text-gray-500 mt-1 font-medium">Auto-fills form using AI</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                 </label>
               )}
               {ocrError && (
                 <div className="bg-danger/20 border border-danger/50 text-danger p-3 rounded-xl text-sm flex items-start">
                   <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                   <span>{ocrError}</span>
                 </div>
               )}
            </div>
            
          </div>

          <div className="p-6 border-t border-white/10 bg-[#111]">
            <button 
              onClick={handleSaveFuel} 
              disabled={uploading}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-[0_10px_20px_rgba(59,130,246,0.3)] active:scale-[0.98] transition disabled:opacity-50 flex justify-center items-center"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : "Save Fuel Record"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
