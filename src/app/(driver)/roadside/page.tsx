"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, FileText, Truck, Shield, FileCheck, X } from 'lucide-react';

const DOCUMENTS = [
  {
    id: 'insurance',
    title: 'Proof of Insurance',
    subtitle: 'Liability & Cargo Coverage',
    icon: <Shield className="w-8 h-8 text-blue-500" />,
    url: '/demo-docs/insurance.pdf', // Placeholder URL
    color: 'border-blue-500/30 bg-blue-500/10'
  },
  {
    id: 'truck_inspection',
    title: 'Annual Truck Inspection',
    subtitle: 'DOT Vehicle Inspection Report',
    icon: <Truck className="w-8 h-8 text-green-500" />,
    url: '/demo-docs/truck-inspection.pdf',
    color: 'border-green-500/30 bg-green-500/10'
  },
  {
    id: 'trailer_inspection',
    title: 'Annual Trailer Inspection',
    subtitle: 'DOT Trailer Inspection Report',
    icon: <FileCheck className="w-8 h-8 text-yellow-500" />,
    url: '/demo-docs/trailer-inspection.pdf',
    color: 'border-yellow-500/30 bg-yellow-500/10'
  },
  {
    id: 'registration',
    title: 'Registration / Cab Card',
    subtitle: 'IRP Cab Card & IFTA',
    icon: <FileText className="w-8 h-8 text-purple-500" />,
    url: '/demo-docs/registration.pdf',
    color: 'border-purple-500/30 bg-purple-500/10'
  }
];

export default function RoadsideInspection() {
  const router = useRouter();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  // Function to simulate opening a PDF
  const handleOpenDoc = (url: string) => {
    setActiveDoc(url);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#000] text-white selection:bg-primary/30">
      {/* Officer Mode Header */}
      <header className="bg-[#111] p-6 pb-8 rounded-b-[40px] shadow-2xl relative z-10 border-b border-white/5">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.push('/driver-app')} className="p-2 -ml-2 bg-white/5 hover:bg-white/10 rounded-full transition">
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div className="flex items-center bg-danger/10 border border-danger/20 px-3 py-1 rounded-full">
             <div className="w-2 h-2 bg-danger rounded-full animate-pulse mr-2"></div>
             <span className="text-xs font-bold text-danger uppercase tracking-wider">Officer Mode Active</span>
          </div>
        </div>
        
        <div className="flex items-center mb-2">
           <ShieldCheck className="w-10 h-10 text-primary mr-4" />
           <div>
              <h1 className="text-2xl font-black text-white leading-tight">Roadside<br/>Inspection</h1>
           </div>
        </div>
        <p className="text-gray-400 text-sm mt-4">Present these documents to the inspecting officer. All sensitive company and load information is hidden in this mode.</p>
      </header>

      {/* Document Grid */}
      <main className="flex-1 p-4 pt-6 space-y-4">
         {DOCUMENTS.map((doc) => (
            <button 
               key={doc.id}
               onClick={() => handleOpenDoc(doc.url)}
               className={`w-full p-5 rounded-2xl border ${doc.color} flex items-center transition-transform active:scale-[0.98] text-left relative overflow-hidden`}
            >
               <div className="mr-5 z-10">{doc.icon}</div>
               <div className="flex-1 z-10">
                  <h3 className="font-bold text-lg text-white mb-1">{doc.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">{doc.subtitle}</p>
               </div>
               
               {/* Decorative background circle */}
               <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
            </button>
         ))}
      </main>

      <div className="p-6 text-center">
         <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Northstar Freight Logistics</p>
         <p className="text-[10px] text-gray-600">DOT #1234567 • MC #765432</p>
      </div>

      {/* Fake PDF Modal */}
      {activeDoc && (
         <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in zoom-in duration-200">
            <header className="flex justify-between items-center px-4 pb-4 pt-14 border-b border-white/10 bg-[#111]">
               <h3 className="font-bold text-white uppercase tracking-wider text-sm flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-primary" /> Verified Document
               </h3>
               <button onClick={() => setActiveDoc(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                  <X className="w-5 h-5 text-white" />
               </button>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
               <FileText className="w-24 h-24 text-gray-700 mb-6" />
               <h2 className="text-xl font-bold mb-2">Document Viewer</h2>
               <p className="text-gray-500 mb-6 max-w-xs mx-auto">In a real environment, the actual PDF of the {activeDoc.split('/').pop()?.replace('.pdf', '')} would load here.</p>
               
               <div className="bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
                  Ready for DOT review
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
