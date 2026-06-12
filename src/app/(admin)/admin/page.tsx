"use client";

import React, { useState } from 'react';
import { Building, ShieldAlert, ShieldCheck, FileText, UploadCloud, Bell, AlertTriangle, CheckCircle2, Clock, Mail, Smartphone, Search } from 'lucide-react';

// Mock Data for Compliance Radar
const complianceDocs = [
  { id: 'DOC-1', name: 'Federal Annual Inspection (FHWA)', entity: 'TRK-105', expiryDate: '2026-06-25', status: 'warning', daysLeft: 15 },
  { id: 'DOC-2', name: 'Federal Annual Inspection (FHWA)', entity: 'TRL-900', expiryDate: '2026-06-12', status: 'critical', daysLeft: 2 },
  { id: 'DOC-3', name: 'Commercial Auto Liability Insurance', entity: 'Company', expiryDate: '2026-12-31', status: 'ok', daysLeft: 204 },
  { id: 'DOC-4', name: 'IFTA License', entity: 'Company', expiryDate: '2026-12-31', status: 'ok', daysLeft: 204 },
  { id: 'DOC-5', name: 'IRP Apportioned Plates', entity: 'TRK-402', expiryDate: '2026-07-01', status: 'warning', daysLeft: 21 },
  { id: 'DOC-6', name: 'UCR Registration', entity: 'Company', expiryDate: '2027-01-01', status: 'ok', daysLeft: 205 },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'radar' | 'vault' | 'settings'>('radar');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  return (
    <div className="h-full flex flex-col gap-6 relative overflow-y-auto hide-scrollbar">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin & Compliance</h1>
          <p className="text-gray-400 mt-1">Company Vault and Document Expiration Radar</p>
        </div>
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
          <button onClick={() => setActiveTab('radar')} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center ${activeTab === 'radar' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}>
            <ShieldAlert className="w-4 h-4 mr-2" /> Compliance Radar
          </button>
          <button onClick={() => setActiveTab('vault')} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center ${activeTab === 'vault' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}>
            <Building className="w-4 h-4 mr-2" /> Company Vault
          </button>
          <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}>
            <Bell className="w-4 h-4 mr-2" /> Alerts Config
          </button>
        </div>
      </header>

      {activeTab === 'radar' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-3 gap-6">
            <div className="glass-panel p-6 flex items-center border-b-4 border-success">
              <CheckCircle2 className="w-12 h-12 text-success mr-4" />
              <div>
                <h3 className="text-2xl font-black text-white">4</h3>
                <p className="text-gray-400 text-sm font-bold uppercase">Documents Safe</p>
              </div>
            </div>
            <div className="glass-panel p-6 flex items-center border-b-4 border-warning">
              <Clock className="w-12 h-12 text-warning mr-4" />
              <div>
                <h3 className="text-2xl font-black text-white">2</h3>
                <p className="text-gray-400 text-sm font-bold uppercase">Expiring Soon (30 Days)</p>
              </div>
            </div>
            <div className="glass-panel p-6 flex items-center border-b-4 border-red-500 bg-red-500/5">
              <AlertTriangle className="w-12 h-12 text-red-500 mr-4" />
              <div>
                <h3 className="text-2xl font-black text-white">1</h3>
                <p className="text-red-400 text-sm font-bold uppercase">Critical / Expired</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Upcoming Expirations</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search document or truck..." className="bg-white/5 border border-white/10 rounded-lg pl-9 p-2 text-sm text-white w-64" />
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-white/10">
                  <th className="pb-3 font-medium">Document Name</th>
                  <th className="pb-3 font-medium">Entity / Asset</th>
                  <th className="pb-3 font-medium">Expiration Date</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {complianceDocs.sort((a,b) => a.daysLeft - b.daysLeft).map(doc => (
                  <tr key={doc.id} className="hover:bg-white/5 transition">
                    <td className="py-4 font-bold flex items-center">
                      <FileText className="w-4 h-4 mr-3 text-gray-400" />
                      {doc.name}
                    </td>
                    <td className="py-4 text-gray-300">
                      <span className="bg-white/10 px-2 py-1 rounded text-xs">{doc.entity}</span>
                    </td>
                    <td className="py-4 font-mono text-sm">{doc.expiryDate}</td>
                    <td className="py-4 text-right">
                      {doc.status === 'ok' && <span className="text-success bg-success/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Valid ({doc.daysLeft} days)</span>}
                      {doc.status === 'warning' && <span className="text-warning bg-warning/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center"><Clock className="w-3 h-3 mr-1"/> Renew Soon ({doc.daysLeft} days)</span>}
                      {doc.status === 'critical' && <span className="text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center animate-pulse"><AlertTriangle className="w-3 h-3 mr-1"/> Action Required ({doc.daysLeft} days)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'vault' && (
        <div className="grid grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="col-span-2 glass-panel p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center"><Building className="w-5 h-5 mr-2 text-primary" /> Company Documents</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-white/10 rounded-xl p-4 bg-white/5 hover:border-primary/50 transition cursor-pointer">
                <FileText className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-bold text-white mb-1">MC Authority Certificate</h3>
                <p className="text-xs text-gray-400">Uploaded: 01/15/2026</p>
              </div>
              <div className="border border-white/10 rounded-xl p-4 bg-white/5 hover:border-primary/50 transition cursor-pointer">
                <FileText className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-bold text-white mb-1">W-9 Form</h3>
                <p className="text-xs text-gray-400">Uploaded: 01/15/2026</p>
              </div>
              <div className="border border-white/10 rounded-xl p-4 bg-white/5 hover:border-primary/50 transition cursor-pointer">
                <FileText className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-bold text-white mb-1">BOC-3 Processing Agent</h3>
                <p className="text-xs text-gray-400">Uploaded: 02/01/2026</p>
              </div>
              <div className="border border-white/10 rounded-xl p-4 bg-white/5 hover:border-primary/50 transition cursor-pointer">
                <FileText className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-bold text-white mb-1">NOA (Notice of Assignment)</h3>
                <p className="text-xs text-gray-400">Uploaded: 02/10/2026</p>
              </div>
            </div>
          </div>
          <div className="glass-panel p-6 border-dashed border-2 border-white/20 hover:border-primary/50 transition flex flex-col items-center justify-center text-center cursor-pointer">
            <UploadCloud className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="font-bold text-lg mb-2">Upload New Document</h3>
            <p className="text-sm text-gray-500 mb-6">Drag and drop PDF, JPG, or PNG files here.</p>
            <button className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm">Browse Files</button>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass-panel p-6 max-w-2xl animate-in fade-in duration-300">
          <h2 className="text-xl font-bold mb-6 flex items-center"><Bell className="w-5 h-5 mr-2 text-warning" /> Automatic Renewal Alerts</h2>
          <p className="text-gray-400 text-sm mb-8">Configure how you want to be notified when a document (like Annual Inspections, IFTA, or Insurance) is approaching its expiration date.</p>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center">
                <Mail className="w-6 h-6 text-blue-400 mr-4" />
                <div>
                  <h3 className="font-bold text-white">Email Notifications</h3>
                  <p className="text-xs text-gray-400">Send alerts to: admin@northstarfreightlogistics.com</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`w-12 h-6 rounded-full transition-colors relative ${emailAlerts ? 'bg-success' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${emailAlerts ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center">
                <Smartphone className="w-6 h-6 text-blue-400 mr-4" />
                <div>
                  <h3 className="font-bold text-white">SMS Text Alerts</h3>
                  <p className="text-xs text-gray-400">Send texts to: +1 (555) 123-4567</p>
                </div>
              </div>
              <button 
                onClick={() => setSmsAlerts(!smsAlerts)}
                className={`w-12 h-6 rounded-full transition-colors relative ${smsAlerts ? 'bg-success' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${smsAlerts ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="font-bold text-sm mb-4">Alert Schedule (Pre-configured)</h3>
            <ul className="text-sm text-gray-400 space-y-2 list-disc pl-5">
              <li>First Warning: 30 Days before expiration</li>
              <li>Second Warning: 15 Days before expiration</li>
              <li>Final Warning: 5 Days before expiration</li>
              <li className="text-red-400">Critical Alert: Expiration Day</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
