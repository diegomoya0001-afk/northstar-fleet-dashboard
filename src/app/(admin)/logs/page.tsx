"use client";

import React, { useState } from 'react';
import { Download, Calendar, FileText, Search } from 'lucide-react';

const mockLogs = [
  { id: 'LOG-001', date: '2026-06-09', type: 'Pre-Trip', driver: 'Mike Johnson', truck: 'TRK-402', status: 'Passed' },
  { id: 'LOG-002', date: '2026-06-08', type: 'Pre-Trip', driver: 'Mike Johnson', truck: 'TRK-402', status: 'Passed' },
  { id: 'LOG-003', date: '2026-06-08', type: 'Post-Trip', driver: 'Sarah Smith', truck: 'TRK-218', status: 'Passed w/ Defect' },
  { id: 'LOG-004', date: '2026-06-07', type: 'HOS Log', driver: 'Robert Chen', truck: 'TRK-332', status: 'Compliant' },
  { id: 'LOG-005', date: '2026-06-06', type: 'Pre-Trip', driver: 'Unassigned', truck: 'TRK-105', status: 'Failed (OOS)' },
];

export default function LogsPage() {
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
              <option>Today (1 Day)</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days (1 Month)</option>
              <option>Last 90 Days (3 Months)</option>
              <option>Custom Range...</option>
            </select>
          </div>
          
          <button className="glass-button px-6 py-2 bg-primary/20 text-primary border border-primary/30 flex items-center shadow-lg shadow-blue-500/20 hover:bg-primary/30 font-semibold" onClick={() => alert('Generating PDF Report...')}>
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
              placeholder="Search driver, truck or log ID..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary/50 text-white placeholder-gray-500 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto hide-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-4 font-medium pl-4">Log ID</th>
                <th className="pb-4 font-medium">Date</th>
                <th className="pb-4 font-medium">Type</th>
                <th className="pb-4 font-medium">Driver & Truck</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium text-right pr-4">Document</th>
              </tr>
            </thead>
            <tbody>
              {mockLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="py-4 pl-4 font-bold">{log.id}</td>
                  <td className="py-4 text-gray-300">{log.date}</td>
                  <td className="py-4">
                    <span className="flex items-center text-gray-300">
                      <FileText className="w-4 h-4 mr-2 text-primary" />
                      {log.type}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="text-white">{log.driver}</div>
                    <div className="text-xs text-gray-500">{log.truck}</div>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      log.status === 'Passed' || log.status === 'Compliant' ? 'bg-success/20 text-success' : 
                      log.status.includes('Defect') ? 'bg-warning/20 text-warning' : 
                      'bg-danger/20 text-danger'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-4 text-right pr-4">
                    <button className="text-primary hover:text-blue-400 font-medium text-sm transition-colors">
                      View PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
