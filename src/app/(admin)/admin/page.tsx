"use client";

import React, { useState } from 'react';
import { Building, ShieldAlert, ShieldCheck, FileText, UploadCloud, Bell, AlertTriangle, CheckCircle2, Clock, Mail, Smartphone, Search, Users, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Removing mock data

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'radar' | 'vault' | 'personnel' | 'settings'>('radar');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Real Docs State
  const [radarDocs, setRadarDocs] = useState<any[]>([]);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  
  // Upload State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadExpDate, setUploadExpDate] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    fetchUsers();
    fetchDocs();
  }, [activeTab]);

  async function fetchDocs() {
    const { data } = await supabase.from('documents').select('*');
    if (data) {
      const radar = data.filter(d => d.expiration_date || d.expiry_date).map(d => {
         // Force UTC midnight to avoid timezone shift locally
         const expVal = d.expiration_date || d.expiry_date;
         const exp = new Date(expVal + 'T00:00:00');
         const now = new Date();
         const diffTime = exp.getTime() - now.getTime();
         const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         
         let status = 'ok';
         if (daysLeft <= 0) status = 'critical';
         else if (daysLeft <= 30) status = 'warning';

         return {
           ...d,
           daysLeft,
           status
         };
      });
      setRadarDocs(radar);
      setVaultDocs(data.filter(d => d.entity_type === 'company').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
  }

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleUpload() {
    if (!uploadName || !uploadFile) {
       alert("Please provide a document name and select a file.");
       return;
    }
    
    setUploading(true);
    const fileExt = uploadFile.name.split('.').pop();
    const fileName = `company-${Date.now()}.${fileExt}`;
    const filePath = `company/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadFile);
    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

    const { error: dbError } = await supabase.from('documents').insert([{
      entity_type: 'company',
      entity_id: '00000000-0000-0000-0000-000000000000',
      doc_type: 'company_doc',
      file_url: publicUrl,
      notes: uploadName,
      expiration_date: uploadExpDate || null
    }]);

    if (!dbError) {
      setUploadName('');
      setUploadExpDate('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocs();
      alert("Document uploaded to Company Vault!");
    } else {
      alert("Error saving document: " + dbError.message);
    }
    setUploading(false);
  }

  async function handleDeleteDoc(id: string, url: string) {
     if (!confirm("Delete this document?")) return;
     const filePath = `company/${url.split('/').pop()}`;
     await supabase.storage.from('documents').remove([filePath]);
     await supabase.from('documents').delete().eq('id', id);
     fetchDocs();
  }

  const safeCount = radarDocs.filter(d => d.status === 'ok').length;
  const warningCount = radarDocs.filter(d => d.status === 'warning').length;
  const criticalCount = radarDocs.filter(d => d.status === 'critical').length;

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
          <button onClick={() => setActiveTab('personnel')} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center ${activeTab === 'personnel' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}>
            <Users className="w-4 h-4 mr-2" /> Personnel
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
                <h3 className="text-2xl font-black text-white">{safeCount}</h3>
                <p className="text-gray-400 text-sm font-bold uppercase">Documents Safe</p>
              </div>
            </div>
            <div className="glass-panel p-6 flex items-center border-b-4 border-warning">
              <Clock className="w-12 h-12 text-warning mr-4" />
              <div>
                <h3 className="text-2xl font-black text-white">{warningCount}</h3>
                <p className="text-gray-400 text-sm font-bold uppercase">Expiring Soon (30 Days)</p>
              </div>
            </div>
            <div className="glass-panel p-6 flex items-center border-b-4 border-red-500 bg-red-500/5">
              <AlertTriangle className="w-12 h-12 text-red-500 mr-4" />
              <div>
                <h3 className="text-2xl font-black text-white">{criticalCount}</h3>
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
                {radarDocs.sort((a,b) => a.daysLeft - b.daysLeft).map(doc => (
                  <tr key={doc.id} className="hover:bg-white/5 transition">
                    <td className="py-4 font-bold flex items-center">
                      <FileText className="w-4 h-4 mr-3 text-gray-400" />
                      {doc.notes || doc.doc_type}
                    </td>
                    <td className="py-4 text-gray-300">
                      <span className="bg-white/10 px-2 py-1 rounded text-xs uppercase tracking-wider">{doc.entity_type} {doc.entity_id && doc.entity_id !== '00000000-0000-0000-0000-000000000000' ? doc.entity_id.split('-')[0] : ''}</span>
                    </td>
                    <td className="py-4 font-mono text-sm">{doc.expiration_date || doc.expiry_date}</td>
                    <td className="py-4 text-right">
                      {doc.status === 'ok' && <span className="text-success bg-success/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Valid ({doc.daysLeft} days)</span>}
                      {doc.status === 'warning' && <span className="text-warning bg-warning/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center"><Clock className="w-3 h-3 mr-1"/> Renew Soon ({doc.daysLeft} days)</span>}
                      {doc.status === 'critical' && <span className="text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center animate-pulse"><AlertTriangle className="w-3 h-3 mr-1"/> Action Required ({doc.daysLeft} days)</span>}
                    </td>
                  </tr>
                ))}
                {radarDocs.length === 0 && (
                   <tr><td colSpan={4} className="py-8 text-center text-gray-500">No documents with expiration dates found.</td></tr>
                )}
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
              {vaultDocs.map(doc => (
                <div key={doc.id} className="border border-white/10 rounded-xl p-4 bg-white/5 hover:border-primary/50 transition flex flex-col justify-between group relative">
                  <button onClick={() => handleDeleteDoc(doc.id, doc.file_url)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><AlertTriangle className="w-4 h-4"/></button>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="block cursor-pointer flex-1">
                    <FileText className="w-8 h-8 text-blue-400 mb-3" />
                    <h3 className="font-bold text-white mb-1">{doc.notes || 'Company Document'}</h3>
                    <p className="text-xs text-gray-400">Uploaded: {new Date(doc.created_at).toLocaleDateString()}</p>
                    {(doc.expiration_date || doc.expiry_date) && <p className="text-xs text-warning mt-1">Expires: {doc.expiration_date || doc.expiry_date}</p>}
                  </a>
                </div>
              ))}
              {vaultDocs.length === 0 && (
                <div className="col-span-2 text-center text-gray-500 py-10">No company documents uploaded yet.</div>
              )}
            </div>
          </div>
          <div className="glass-panel p-6 border border-white/10 flex flex-col text-center">
             <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-6 hover:border-primary/50 transition">
               <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
               <h3 className="font-bold text-lg mb-2">Upload New Document</h3>
               <p className="text-sm text-gray-500 mb-6">Store your W-9, MC Authority, etc.</p>
               
               <div className="w-full space-y-3 text-left">
                  <input type="text" value={uploadName} onChange={e=>setUploadName(e.target.value)} placeholder="Document Name (e.g. W-9)" className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm focus:border-primary outline-none" />
                  <div>
                    <label className="text-xs text-gray-500 font-bold mb-1 block">Expiration Date (Optional)</label>
                    <input type="date" value={uploadExpDate} onChange={e=>setUploadExpDate(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm focus:border-primary outline-none" style={{colorScheme: 'dark'}} />
                  </div>
                  <input type="file" ref={fileInputRef} onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
               </div>

               <button disabled={uploading} onClick={handleUpload} className="mt-6 w-full px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition disabled:opacity-50">
                 {uploading ? 'Uploading...' : 'Save Document'}
               </button>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'personnel' && (
        <div className="glass-panel p-6 animate-in fade-in duration-300 flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center"><Users className="w-5 h-5 mr-2 text-primary" /> Personnel Management</h2>
            <button className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold transition text-sm">
              + Invite User
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center text-gray-500 py-10">Loading personnel...</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-sm">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/5 transition">
                      <td className="py-4 font-bold">{u.first_name} {u.last_name}</td>
                      <td className="py-4 text-gray-400 text-sm">{u.email}</td>
                      <td className="py-4 text-gray-300 text-sm">{u.phone || 'N/A'}</td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                          u.role === 'dispatcher' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button className="text-gray-400 hover:text-white p-2" title="Edit User">
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">No personnel found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
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
