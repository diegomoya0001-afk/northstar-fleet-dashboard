"use client";

import React, { useState, useEffect } from 'react';
import { Download, Calendar, FileText, Search, Edit2, Trash2, Eye, X } from 'lucide-react';
import PinModal from '@/components/PinModal';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDuration(start: string, end: string | null, isActive: boolean = false) {
  if (!start) return '-';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : new Date().getTime();
  if (start === end) return 'Completed';
  const diff = Math.max(0, e - s);
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (isActive) return `Active (${h}h ${m}m)`;
  return `${h}h ${m}m`;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Security & Editing states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<'edit' | 'delete' | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [editStatus, setEditStatus] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  const handleActionClick = (action: 'edit' | 'delete', log: any) => {
     setPinAction(action);
     setSelectedLog(log);
     setShowPinModal(true);
  };

  const handlePinSuccess = () => {
     setShowPinModal(false);
     if (pinAction === 'delete') {
        executeDelete();
     } else if (pinAction === 'edit') {
        if (selectedLog.type !== 'HOS Log') {
           alert("Editing is only supported for HOS Logs.");
           return;
        }
        setEditStatus(selectedLog.raw.status);
        const formatForInput = (isoStr: string) => {
           if (!isoStr) return '';
           const d = new Date(isoStr);
           d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
           return d.toISOString().slice(0, 16);
        };
        setEditStartTime(formatForInput(selectedLog.raw.start_time));
        setEditEndTime(formatForInput(selectedLog.raw.end_time));
        setShowEditModal(true);
     }
  };

  const executeDelete = async () => {
     if (!selectedLog) return;
     const table = selectedLog.type === 'HOS Log' ? 'hos_logs' : 'inspections';
     const { error } = await supabase.from(table).delete().eq('id', selectedLog.real_id);
     if (error) {
        alert("Error deleting log: " + error.message);
     } else {
        fetchComplianceLogs();
     }
     setSelectedLog(null);
  };

  const executeEdit = async () => {
     if (!selectedLog) return;
     const { error } = await supabase.from('hos_logs').update({
        status: editStatus,
        start_time: new Date(editStartTime).toISOString(),
        end_time: editEndTime ? new Date(editEndTime).toISOString() : null
     }).eq('id', selectedLog.real_id);

     if (error) {
        alert("Error updating log: " + error.message);
     } else {
        setShowEditModal(false);
        setSelectedLog(null);
        fetchComplianceLogs();
     }
  };

  useEffect(() => {
    fetchComplianceLogs();
  }, []);

  async function fetchComplianceLogs() {
    setLoading(true);
    
    // Fetch Pre-Trips
    const { data: inspectionsData, error: insError } = await supabase
      .from('inspections')
      .select('*, users(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch HOS 
    // In a real app we would aggregate by day, here we just fetch recent logs
    const { data: hosData, error: hosError } = await supabase
      .from('hos_logs')
      .select('id, start_time, end_time, status, users(first_name, last_name)')
      .order('start_time', { ascending: false })
      .limit(50);

    let combined: any[] = [];
    
    if (inspectionsData) {
      combined = [...combined, ...inspectionsData.map(i => ({
        id: i.id.split('-')[0],
        real_id: i.id,
        date: new Date(i.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        sortDate: new Date(i.created_at),
        type: i.type === 'pre_trip' ? 'Pre-Trip DVIR' : 'Post-Trip DVIR',
        driver: i.users ? `${(i.users as any).first_name} ${(i.users as any).last_name}` : 'Unknown',
        driver_name: i.users ? `${(i.users as any).first_name} ${(i.users as any).last_name}` : 'Unknown',
        status: i.status === 'passed' ? 'Passed' : i.status === 'passed_with_defect' ? 'Passed w/ Defect' : 'Failed (OOS)',
        duration: 'Completed',
        raw: i
      }))];
    }

    if (hosData) {
      // Group by driver to calculate missing end_times
      const groupedByDriver: Record<string, any[]> = {};
      hosData.forEach(h => {
         const driverName = h.users ? `${(h.users as any).first_name} ${(h.users as any).last_name}` : 'Unknown';
         if (!groupedByDriver[driverName]) groupedByDriver[driverName] = [];
         groupedByDriver[driverName].push(h);
      });

      // Calculate durations
      const processedHos = [];
      for (const driverName in groupedByDriver) {
         // Sort asc by start_time to find next log easily
         const driverLogs = groupedByDriver[driverName].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
         for (let i = 0; i < driverLogs.length; i++) {
            const h = driverLogs[i];
            let endTimeStr = h.end_time;
            
            // If no explicit end_time, the end is the start of the next log
            if (!endTimeStr && i < driverLogs.length - 1) {
               endTimeStr = driverLogs[i+1].start_time;
            }
            
            const isActive = (!endTimeStr && i === driverLogs.length - 1);
            const durationStr = formatDuration(h.start_time, endTimeStr, isActive);

            processedHos.push({
              id: h.id.split('-')[0],
              real_id: h.id,
              date: new Date(h.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
              sortDate: new Date(h.start_time),
              type: 'HOS Log',
              driver: driverName,
              driver_name: driverName,
              status: h.status.replace('_', ' '),
              duration: durationStr,
              raw: h
            });
         }
      }

      combined = [...combined, ...processedHos];
    }

    // Sort combined by date desc
    combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    setLogs(combined);
    setLoading(false);
  }

  function handleExportPDF() {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("COMPLIANCE & SAFETY LOGS", 105, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.text("Carrier: Northstar Freight Logistics", 14, 25);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      
      // Table
      const tableData = filteredLogs.map(log => [
        log.id,
        log.date,
        log.type,
        log.driver_name,
        log.status,
        log.duration
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Log ID', 'Date & Time', 'Type', 'Driver', 'Status', 'Duration']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] }
      });

      doc.save(`Compliance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    }
  }

  const filteredLogs = logs.filter(log => 
    log.driver.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance & Logs</h1>
          <p className="text-gray-400 mt-1">Export DOT logs, Pre-Trips, and driver records</p>
        </div>
      </header>

      <div className="glass-panel flex-1 flex flex-col p-6 overflow-hidden">
        {/* Export Toolbar */}
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span>Time Period:</span>
            </div>
            <select className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary">
              <option>Recent (Last 50)</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days (1 Month)</option>
            </select>
          </div>
          
          <button 
             className="glass-button px-6 py-2 bg-primary/20 text-primary border border-primary/30 flex items-center shadow-lg shadow-blue-500/20 hover:bg-primary/30 font-semibold" 
             onClick={handleExportPDF}
          >
            <Download className="w-4 h-4 mr-2" />
            Export to PDF
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex justify-between mb-6">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search driver, type or log ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary/50 text-white placeholder-gray-500 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto hide-scrollbar">
          {loading ? (
             <div className="text-center text-gray-500 mt-10">Loading compliance data...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-sm">
                  <th className="pb-4 font-medium pl-4">Log ID</th>
                  <th className="pb-4 font-medium">Date & Time</th>
                  <th className="pb-4 font-medium">Type</th>
                  <th className="pb-4 font-medium">Driver</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Duration</th>
                  <th className="pb-4 font-medium text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id + log.type} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-4 pl-4 font-bold uppercase">{log.id}</td>
                    <td className="py-4 text-gray-300">{log.date}</td>
                    <td className="py-4">
                      <span className="flex items-center text-gray-300">
                        <FileText className="w-4 h-4 mr-2 text-primary" />
                        {log.type}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="text-white">{log.driver}</div>
                    </td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.status === 'Passed' ? 'bg-green-100 text-green-800' :
                        log.status === 'Failed' ? 'bg-red-100 text-red-800' :
                        log.status === 'DRIVING' ? 'bg-green-100 text-green-800' :
                        log.status === 'ON DUTY' ? 'bg-yellow-100 text-yellow-800' :
                        log.status === 'SLEEPER' ? 'bg-blue-100 text-blue-800' :
                        log.status.includes('Defect') ? 'bg-warning/20 text-warning' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-4 text-gray-400 text-sm font-medium">
                      {log.duration}
                    </td>
                    <td className="py-4 text-right pr-4">
                      <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => alert("Details: " + JSON.stringify(log.raw, null, 2))} className="text-gray-400 hover:text-white transition-colors" title="View Raw">
                          <Eye className="w-4 h-4" />
                        </button>
                        {log.type === 'HOS Log' && (
                          <button onClick={() => handleActionClick('edit', log)} className="text-gray-400 hover:text-blue-400 transition-colors" title="Edit Log">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleActionClick('delete', log)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete Log">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PinModal 
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
        actionText={pinAction === 'edit' ? "edit this log" : "delete this log permanently"}
      />

      {/* Edit Log Modal */}
      {showEditModal && selectedLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit HOS Log</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Driver</label>
                <input type="text" value={selectedLog.driver} disabled className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white opacity-50 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none">
                  <option value="OFF_DUTY">OFF DUTY</option>
                  <option value="SLEEPER">SLEEPER</option>
                  <option value="DRIVING">DRIVING</option>
                  <option value="ON_DUTY">ON DUTY</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Start Time</label>
                <input type="datetime-local" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">End Time (Optional)</label>
                <input type="datetime-local" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none [color-scheme:dark]" />
                <p className="text-[10px] text-gray-500 mt-1">Leave empty if this is the current active status.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition">Cancel</button>
              <button onClick={executeEdit} className="flex-1 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
