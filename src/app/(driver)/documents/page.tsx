"use client";

import React, { useState, useEffect } from 'react';
import { FileText, FolderOpen, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DriverDocuments() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const driverId = typeof window !== 'undefined' ? localStorage.getItem('fleet_user_id') : null;

  useEffect(() => {
    if (driverId) {
      fetchDocuments();
    } else {
      setLoading(false);
    }
  }, [driverId]);

  async function fetchDocuments() {
    setLoading(true);
    // 1. Get the assigned vehicles (trucks and trailers)
    const { data: vData, error: vError } = await supabase
      .from('vehicles')
      .select('id, type')
      .eq('assigned_driver_id', driverId);

    let entityIds = [driverId, '00000000-0000-0000-0000-000000000000']; // Include driver and company
    if (!vError && vData && vData.length > 0) {
       setVehicles(vData);
       entityIds = [...entityIds, ...vData.map((v: any) => v.id)];
    }

    // 2. Fetch documents
    const { data: docsData, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .in('entity_id', entityIds)
      .order('created_at', { ascending: false });

    if (!docsError && docsData) {
      setDocuments(docsData);
    }
    setLoading(false);
  }

  const truck = vehicles.find(v => v.type === 'truck');
  const trailer = vehicles.find(v => v.type === 'trailer');

  // Helper to find specific documents
  const getDocument = (typeMatch: string, entityId?: string, notesMatch?: string) => {
    return documents.find(d => {
       const matchType = d.doc_type?.toLowerCase().includes(typeMatch.toLowerCase());
       const matchEntity = entityId ? d.entity_id === entityId : true;
       const matchNotes = notesMatch ? d.notes?.toLowerCase().includes(notesMatch.toLowerCase()) : true;
       return matchType && matchEntity && matchNotes;
    });
  };

  const cabCard = getDocument('registration', truck?.id) || getDocument('cab card', truck?.id) || getDocument('registration', trailer?.id) || getDocument('cab card', trailer?.id) || getDocument('company_doc', '00000000-0000-0000-0000-000000000000', 'Cab Card');
  const insurance = getDocument('insurance', truck?.id) || getDocument('insurance', trailer?.id) || getDocument('company_doc', '00000000-0000-0000-0000-000000000000', 'Insurance') || getDocument('insurance');
  const truckInspection = getDocument('annual_inspection', truck?.id) || getDocument('inspection', truck?.id) || getDocument('truck inspection');
  const trailerInspection = getDocument('annual_inspection', trailer?.id) || getDocument('inspection', trailer?.id) || getDocument('trailer inspection');

  const requiredDocs = [
    { title: 'Cab Card', doc: cabCard, icon: <FolderOpen className="w-6 h-6 text-primary" /> },
    { title: 'Proof of Insurance', doc: insurance, icon: <FileText className="w-6 h-6 text-primary" /> },
    { title: 'Annual Truck Inspection', doc: truckInspection, icon: <AlertCircle className="w-6 h-6 text-primary" /> },
    { title: 'Annual Trailer Inspection', doc: trailerInspection, icon: <AlertCircle className="w-6 h-6 text-primary" /> }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#000] text-white">
      {/* Header */}
      <header className="bg-[#111] p-6 pt-20 pb-8 rounded-b-[40px] shadow-2xl relative z-10 border-b border-white/5">
        <div className="flex justify-between items-center mb-2">
           <h1 className="text-2xl font-black text-white flex items-center">
              <FolderOpen className="w-6 h-6 mr-3 text-primary" /> Glovebox
           </h1>
        </div>
        <p className="text-gray-400 text-sm mt-3 font-medium">Digital copies of your required compliance documents.</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
         {loading ? (
           <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
           </div>
         ) : (
           <div className="space-y-4">
              {requiredDocs.map((item, idx) => {
                 const isExpiringSoon = item.doc?.expiry_date && new Date(item.doc.expiry_date).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
                 
                 if (!item.doc) {
                    return (
                      <div key={idx} className="bg-[#111] border border-white/5 p-4 rounded-2xl flex items-center relative opacity-50">
                         <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mr-4 shrink-0">
                            {item.icon}
                         </div>
                         <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base mb-1">{item.title}</h3>
                            <p className="text-xs text-danger font-bold">Not Uploaded</p>
                         </div>
                      </div>
                    );
                 }

                 return (
                   <a 
                     key={idx} 
                     href={item.doc.file_url} 
                     target="_blank" 
                     rel="noreferrer"
                     className="block bg-[#111] border border-white/10 p-4 rounded-2xl active:scale-[0.98] transition hover:bg-white/5 relative overflow-hidden"
                   >
                      <div className="flex items-center">
                         <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mr-4 shrink-0">
                            {item.icon}
                         </div>
                         <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base mb-1 truncate">{item.title}</h3>
                            {item.doc.expiry_date ? (
                               <p className={`text-xs font-bold flex items-center ${isExpiringSoon ? 'text-warning' : 'text-gray-500'}`}>
                                  <Calendar className="w-3 h-3 mr-1" /> 
                                  {isExpiringSoon ? 'Expiring Soon: ' : 'Expires: '} 
                                  {new Date(item.doc.expiry_date).toLocaleDateString()}
                               </p>
                            ) : (
                               <p className="text-xs font-bold text-success">Active Document</p>
                            )}
                         </div>
                      </div>
                   </a>
                 );
              })}
           </div>
         )}
      </main>
    </div>
  );
}
