"use client";

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, MapPin, Calendar, Power, BedDouble, Truck, Briefcase, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUS_COLORS: Record<string, string> = {
  'OFF_DUTY': 'bg-gray-500',
  'SLEEPER': 'bg-blue-500',
  'DRIVING': 'bg-success',
  'ON_DUTY': 'bg-warning',
  'Pre-Trip DVIR': 'bg-purple-500'
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  'OFF_DUTY': <Power className="w-5 h-5" />,
  'SLEEPER': <BedDouble className="w-5 h-5" />,
  'DRIVING': <Truck className="w-5 h-5" />,
  'ON_DUTY': <Briefcase className="w-5 h-5" />,
  'Pre-Trip DVIR': <CheckCircle className="w-5 h-5" />
};

export default function HosLogs() {
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  const [logs, setLogs] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>('OFF_DUTY');
  const [loading, setLoading] = useState(true);
  const driverId = typeof window !== 'undefined' ? localStorage.getItem('fleet_user_id') : null;

  // Basic timers (Mocked real-time calculation for now)
  const [clocks, setClocks] = useState([
    { label: 'Driving', remaining: '11:00', total: '11:00', percent: 100, color: 'text-success', bg: 'border-success' },
    { label: 'Shift', remaining: '14:00', total: '14:00', percent: 100, color: 'text-success', bg: 'border-success' },
    { label: 'Cycle (8 Days)', remaining: '70:00', total: '70:00', percent: 100, color: 'text-warning', bg: 'border-warning' },
    { label: 'Break', remaining: '08:00', total: '08:00', percent: 100, color: 'text-primary', bg: 'border-primary' }
  ]);

  useEffect(() => {
    if (driverId) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [driverId]);

  // Real-time ticking for the ELD clocks
  useEffect(() => {
    if (logs.length === 0) return;
    const interval = setInterval(() => {
      calculateClocks(logs);
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [logs]);

  async function fetchLogs() {
    setLoading(true);
    
    // Get today's start and end times in ISO format
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: hosData, error: hosError } = await supabase
      .from('hos_logs')
      .select('*')
      .eq('driver_id', driverId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());

    // Fetch the absolute latest log to get current status reliably (even if from yesterday)
    const { data: latestLog } = await supabase
      .from('hos_logs')
      .select('status')
      .eq('driver_id', driverId)
      .order('start_time', { ascending: false })
      .limit(1);
      
    if (latestLog && latestLog.length > 0) {
      setCurrentStatus(latestLog[0].status);
    }

    const { data: inspData, error: inspError } = await supabase
      .from('inspections')
      .select('*')
      .eq('driver_id', driverId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    let combined: any[] = [];
    if (hosData) {
      combined = combined.concat(hosData.map(d => ({...d, _type: 'hos'})));
    }
    if (inspData) {
      combined = combined.concat(inspData.map(d => ({
        ...d,
        _type: 'inspection',
        start_time: d.created_at,
        end_time: d.created_at,
        status: 'Pre-Trip DVIR',
        location_lat: null,
        location_lng: null
      })));
    }

    combined.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    setLogs(combined);
    if (combined.length > 0) {
      calculateClocks(combined);
    }
    setLoading(false);
  }

  function calculateClocks(dailyLogs: any[]) {
    // Basic mock logic to reduce driving time based on log entries
    let drivingMs = 0;
    dailyLogs.forEach(log => {
      if (log.status === 'DRIVING') {
        const start = new Date(log.start_time).getTime();
        const end = log.end_time ? new Date(log.end_time).getTime() : new Date().getTime();
        drivingMs += (end - start);
      }
    });

    const totalDrivingMs = 11 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, totalDrivingMs - drivingMs);
    
    const h = Math.floor(remainingMs / (1000 * 60 * 60));
    const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    setClocks(prev => {
      const updated = [...prev];
      updated[0].remaining = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (h < 2) {
        updated[0].color = 'text-danger';
        updated[0].bg = 'border-danger';
      } else if (h < 5) {
        updated[0].color = 'text-warning';
        updated[0].bg = 'border-warning';
      }
      return updated;
    });
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return;

    if (!navigator.geolocation) {
      return executeStatusChange(newStatus, null, null);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => executeStatusChange(newStatus, pos.coords.latitude, pos.coords.longitude),
      (err) => executeStatusChange(newStatus, null, null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  async function executeStatusChange(newStatus: string, lat: number | null, lng: number | null) {
    setLoading(true);
    const now = new Date().toISOString();

    // 1. Close current active log if exists
    if (logs.length > 0) {
      const activeLog = logs.slice().reverse().find(l => l._type === 'hos');
      if (activeLog && !activeLog.end_time) {
        await supabase.from('hos_logs').update({ end_time: now }).eq('id', activeLog.id);
      }
    }

    // 2. Insert new log
    const { error } = await supabase.from('hos_logs').insert([{
      driver_id: driverId,
      status: newStatus,
      start_time: now,
      location_lat: lat,
      location_lng: lng
    }]);

    if (!error) {
      setCurrentStatus(newStatus);
      fetchLogs();
    } else {
      alert("Error saving log: " + error.message);
    }
  }

  // Helper to format duration
  function formatDuration(start: string, end: string | null) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : new Date().getTime();
    if (end === start) return 'Completed';
    const diff = e - s;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return end ? `${h}h ${m}m` : 'Active';
  }

  async function handleExportPDF() {
     try {
       const doc = new jsPDF();
       const driverName = typeof window !== 'undefined' ? localStorage.getItem('fleet_user_name') || 'Driver' : 'Driver';
       
       // Header
       doc.setFontSize(18);
       doc.text("DRIVER'S DAILY LOG", 105, 15, { align: 'center' });
       doc.setFontSize(10);
       doc.text("Carrier: Northstar Freight Logistics", 14, 25);
       doc.text(`Driver: ${driverName}`, 14, 30);
       doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 35);
       
       // Table
       const tableData = logs.map(log => [
         new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
         (log.end_time && log.end_time !== log.start_time) ? new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (log._type === 'inspection' ? '-' : 'Active'),
         log.status.replace('_', ' '),
         log.location_lat ? `${log.location_lat.toFixed(2)}, ${log.location_lng.toFixed(2)}` : 'Manual',
         formatDuration(log.start_time, log.end_time)
       ]);

       autoTable(doc, {
         startY: 45,
         head: [['Start', 'End', 'Duty Status', 'Location', 'Duration']],
         body: tableData,
         theme: 'grid',
         headStyles: { fillColor: [22, 160, 133] }
       });

       const pdfUrl = doc.output('bloburl');
       window.open(pdfUrl, '_blank');
       
     } catch (err) {
       console.error(err);
       alert("Error generating PDF.");
     }
  }


  return (
    <div className="flex flex-col min-h-screen bg-[#000] text-white">
      {/* Header */}
      <header className="bg-[#111] p-6 pt-20 pb-8 rounded-b-[40px] shadow-2xl relative z-10 border-b border-white/5">
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-black text-white flex items-center">
              <Clock className="w-6 h-6 mr-3 text-primary" /> Logbook
           </h1>
           <div className="flex items-center gap-2">
             <button onClick={handleExportPDF} className="bg-primary/20 text-primary border border-primary/30 p-2 rounded-full hover:bg-primary/30 transition">
                <Download className="w-5 h-5" />
             </button>
             <div className="flex items-center text-xs font-bold text-gray-400 bg-white/5 px-3 py-1.5 rounded-full">
                <Calendar className="w-4 h-4 mr-2" /> {currentDate}
             </div>
           </div>
        </div>
        
        {/* ELD Status Indicator */}
        <div className={`${STATUS_COLORS[currentStatus]?.replace('bg-', 'bg-')}/10 border border-${STATUS_COLORS[currentStatus]?.replace('bg-', '')}/20 p-4 rounded-2xl flex items-center justify-between`}>
           <div>
              <p className={`text-xs ${STATUS_COLORS[currentStatus]?.replace('bg-', 'text-')}/70 font-bold uppercase mb-1`}>Current Status</p>
              <div className="flex items-center">
                 <div className={`w-3 h-3 ${STATUS_COLORS[currentStatus]} rounded-full animate-pulse mr-2`}></div>
                 <span className={`font-bold ${STATUS_COLORS[currentStatus]?.replace('bg-', 'text-')} text-lg tracking-wider`}>{currentStatus.replace('_', ' ')}</span>
              </div>
           </div>
        </div>

        {/* Change Status Buttons */}
        <div className="mt-6 grid grid-cols-4 gap-2">
          {['OFF_DUTY', 'SLEEPER', 'DRIVING', 'ON_DUTY'].map((status) => (
            <button 
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={loading || currentStatus === status}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition active:scale-95 disabled:opacity-50 ${currentStatus === status ? `${STATUS_COLORS[status]} border-transparent shadow-lg text-white` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="mb-1">{STATUS_ICONS[status]}</div>
              <span className="text-[9px] font-black tracking-wider text-center leading-tight">{status.replace('_', '\n')}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-28">
         
         {/* Remaining Clocks */}
         <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Remaining Hours</h2>
            <div className="grid grid-cols-2 gap-4">
               {clocks.map((clock, idx) => (
                  <div key={idx} className="bg-[#111] border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
                     {/* Circular Progress Simulator */}
                     <div className={`w-24 h-24 rounded-full border-4 ${clock.bg} flex items-center justify-center mb-3 relative`}>
                        <span className={`text-xl font-black ${clock.color}`}>{clock.remaining}</span>
                     </div>
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{clock.label}</span>
                  </div>
               ))}
            </div>
         </section>

         {/* Status History */}
         <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Today's Events</h2>
            {logs.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm font-bold">No logs yet today.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-white/10">
                 {logs.map((log, idx) => (
                    <div key={idx} className="bg-[#111] border border-white/5 p-4 rounded-2xl flex items-center relative ml-8">
                       <div className={`absolute -left-[31px] w-3 h-3 ${STATUS_COLORS[log.status]} rounded-full ring-4 ring-[#000]`}></div>
                       
                       <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                             <span className={`text-sm font-black tracking-wider ${(STATUS_COLORS[log.status] || 'bg-gray-500').replace('bg-', 'text-')}`}>{log.status.replace('_', ' ')}</span>
                             <span className="text-xs font-bold text-gray-500">
                               {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                             <p className="text-xs text-gray-400 flex items-center">
                               <MapPin className="w-3 h-3 mr-1" /> 
                               {log.location_lat ? `${log.location_lat.toFixed(2)}, ${log.location_lng.toFixed(2)}` : 'Manual Location'}
                             </p>
                             <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-gray-300">
                               {formatDuration(log.start_time, log.end_time)}
                             </span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
            )}
         </section>

      </main>
    </div>
  );
}
