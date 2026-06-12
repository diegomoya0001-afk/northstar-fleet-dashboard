"use client";

import React, { useState, useEffect } from "react";
import { Wrench, Plus, X, Upload, Camera, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
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

export default function RepairsModule() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  // Form states
  const [dateIn, setDateIn] = useState(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
  });
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [partsReplaced, setPartsReplaced] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);

  const driverId = typeof window !== 'undefined' ? localStorage.getItem('fleet_user_id') : null;

  useEffect(() => {
    if (driverId) {
      fetchVisits();
    } else {
      router.push('/login');
    }
  }, [driverId, router]);

  // Auto-calculate total cost
  useEffect(() => {
    const l = parseFloat(laborCost) || 0;
    const p = parseFloat(partsCost) || 0;
    if (l > 0 || p > 0) {
      setTotalCost((l + p).toFixed(2));
    }
  }, [laborCost, partsCost]);

  async function fetchVisits() {
    setLoading(true);
    const { data, error } = await supabase
      .from('shop_visits')
      .select('*, vehicles(unit_number)')
      .eq('reported_by', driverId)
      .order('date_in', { ascending: false });
    
    if (!error && data) {
      setVisits(data);
    }
    setLoading(false);
  }

  async function handleSaveRepair() {
    if (!dateIn || !workPerformed || !totalCost || (invoiceFiles.length === 0)) {
      alert("Please fill Date, Work Performed, Total Cost, and attach at least one invoice photo.");
      return;
    }

    setUploading(true);
    try {
      // 1. Get assigned vehicle
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('assigned_driver_id', driverId)
        .eq('type', 'truck')
        .limit(1)
        .single();
      
      const vehicleId = vehicleData ? vehicleData.id : null;

      // 2. Upload invoices
      let invoiceUrls: string[] = [];
      if (invoiceFiles.length > 0) {
        for (const file of invoiceFiles) {
          const base64DataUrl = await compressImage(file);
          
          // Convert base64 back to File
          const arr = base64DataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while(n--){
              u8arr[n] = bstr.charCodeAt(n);
          }
          const compressedFile = new File([u8arr], file.name || 'invoice.jpg', {type: mime});

          const fileExt = compressedFile.name.split('.').pop() || 'jpg';
          const fileName = `repair-${driverId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `shop_invoices/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, compressedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
          invoiceUrls.push(publicUrl);
        }
      }

      // 3. Insert shop visit
      const { error: insertError } = await supabase
        .from('shop_visits')
        .insert([{
          reported_by: driverId,
          vehicle_id: vehicleId,
          date_in: dateIn,
          date_out: dateIn, // Assume same day for roadside
          shop_name: shopName,
          shop_location: `${city}, ${state} ${zip}`.trim(),
          work_performed: workPerformed,
          parts_replaced: partsReplaced,
          labor_cost: parseFloat(laborCost || "0"),
          parts_cost: parseFloat(partsCost || "0"),
          total_cost: parseFloat(totalCost),
          invoice_url: invoiceUrls.length > 0 ? invoiceUrls.join(',') : null,
          status: 'completed',
          is_driver_reported: true
        }]);

      if (insertError) throw insertError;

      // Reset and reload
      setShowModal(false);
      setDateIn("");
      setShopName("");
      setCity("");
      setState("TX");
      setZip("");
      setWorkPerformed("");
      setPartsReplaced("");
      setLaborCost("");
      setPartsCost("");
      setTotalCost("");
      setInvoiceFiles([]);
      fetchVisits();
      
    } catch (err: any) {
      alert("Error saving repair log: " + err.message);
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#000] text-white">
      {/* Header */}
      <header className="bg-[#111] p-6 pb-8 rounded-b-[40px] shadow-2xl relative z-10 border-b border-white/5">
        <div className="flex justify-between items-center">
           <h1 className="text-2xl font-black text-white flex items-center">
              <Wrench className="w-6 h-6 mr-3 text-warning" /> Repairs & Maintenance
           </h1>
        </div>
        <p className="text-gray-400 text-sm mt-3 font-medium">Log roadside repairs and shop visits</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
         {loading ? (
           <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-warning border-t-transparent rounded-full animate-spin"></div>
           </div>
         ) : visits.length === 0 ? (
           <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                 <Wrench className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">No Repairs Logged</h3>
              <p className="text-gray-400 text-sm">You haven't submitted any repair tickets or shop visits yet.</p>
           </div>
         ) : (
           <div className="space-y-4">
              {visits.map((visit) => {
                 const date = new Date(visit.date_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                 return (
                   <div key={visit.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:bg-white/5 transition">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center mr-3">
                             <Wrench className="w-5 h-5 text-warning" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{date}</h3>
                            <p className="text-xl font-black text-white">${Number(visit.total_cost).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/50 rounded-xl p-3 space-y-2 text-sm border border-white/5">
                        <div className="flex items-start text-gray-300">
                          <span className="font-bold mr-2 text-warning">Shop:</span>
                          <span>{visit.shop_name || 'N/A'}</span>
                        </div>
                        <div className="flex items-start text-gray-300">
                          <span className="font-bold mr-2 text-warning">Work:</span>
                          <span>{visit.work_performed}</span>
                        </div>
                        {visit.parts_replaced && (
                          <div className="flex items-start text-gray-400 text-xs">
                            <span className="mr-2">Parts:</span>
                            <span>{visit.parts_replaced}</span>
                          </div>
                        )}
                      </div>

                      {visit.invoice_url && (
                        <div className="absolute top-5 right-5 flex gap-2">
                          {visit.invoice_url.split(',').map((url: string, idx: number) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-warning transition p-2 bg-white/5 rounded-full" title={`View Invoice ${idx + 1}`}>
                              <FileText className="w-4 h-4" />
                            </a>
                          ))}
                        </div>
                      )}
                   </div>
                 );
              })}
           </div>
         )}
      </main>

      {/* FAB for Adding Repair */}
      <div className="fixed bottom-24 right-6 z-40 animate-in zoom-in duration-300">
        <button onClick={() => setShowModal(true)} className="w-16 h-16 bg-warning text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition">
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* Add Repair Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300">
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#111]">
            <h2 className="text-xl font-bold text-warning flex items-center"><Wrench className="w-5 h-5 mr-2" /> Log Repair</h2>
            <button onClick={() => setShowModal(false)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-32">
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Date *</label>
                  <input type="date" value={dateIn} onChange={e => setDateIn(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base font-bold outline-none focus:border-warning transition" />
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Shop Name / Roadside Service</label>
                  <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition" placeholder="e.g. TA Mobile Service" />
               </div>

               <div className="grid grid-cols-3 gap-3">
                 <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">City</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition" placeholder="City" />
                 </div>
                 <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">State</label>
                    <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition" placeholder="TX" />
                 </div>
                 <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">ZIP</label>
                    <input type="text" value={zip} onChange={e => setZip(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition" placeholder="12345" />
                 </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Work Performed *</label>
                  <textarea value={workPerformed} onChange={e => setWorkPerformed(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition min-h-[80px]" placeholder="e.g. Replaced blown trailer tire"></textarea>
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Parts Replaced</label>
                  <input type="text" value={partsReplaced} onChange={e => setPartsReplaced(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-base outline-none focus:border-warning transition" placeholder="e.g. 1 Super Single Tire" />
               </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Labor Cost ($)</label>
                    <input type="number" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-lg font-bold outline-none focus:border-warning transition" placeholder="0.00" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Parts Cost ($)</label>
                    <input type="number" step="0.01" value={partsCost} onChange={e => setPartsCost(e.target.value)} className="w-full bg-[#000] border border-white/10 rounded-xl p-3 text-lg font-bold outline-none focus:border-warning transition" placeholder="0.00" />
                 </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-warning uppercase mb-1 block">Total Cost ($) *</label>
                  <input type="number" step="0.01" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full bg-warning/10 border border-warning/30 rounded-xl p-3 text-lg font-bold text-warning outline-none focus:border-warning transition" placeholder="$150.00" />
               </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
               <label className="text-xs font-bold text-gray-400 uppercase mb-3 block flex justify-between items-center">
                 <span>Invoice Photos (Multiple allowed) *</span>
               </label>

               <div className="space-y-2 mb-3">
                 {invoiceFiles.map((f, i) => (
                   <div key={i} className="bg-[#000] p-3 rounded-xl border border-white/10 flex items-center justify-between">
                      <div className="flex items-center overflow-hidden">
                         <FileText className="w-5 h-5 text-warning mr-3 shrink-0" />
                         <span className="text-sm truncate">{f.name}</span>
                      </div>
                      <button onClick={() => setInvoiceFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-danger ml-2 p-2">
                        <X className="w-4 h-4" />
                      </button>
                   </div>
                 ))}
               </div>

               <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 hover:border-warning/50 transition hover:bg-white/5 rounded-xl cursor-pointer relative overflow-hidden">
                  <Camera className="w-8 h-8 text-gray-500 mb-2" />
                  <span className="text-sm font-bold text-warning">Take Photo or Upload</span>
                  <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => {
                    if (e.target.files) {
                      setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }} />
               </label>
            </div>
            
          </div>

          <div className="p-6 border-t border-white/10 bg-[#111]">
            <button 
              onClick={handleSaveRepair} 
              disabled={uploading}
              className="w-full bg-warning text-black font-bold py-4 rounded-2xl shadow-[0_10px_20px_rgba(234,179,8,0.3)] active:scale-[0.98] transition disabled:opacity-50 flex justify-center items-center"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </>
              ) : "Save Repair Record"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
