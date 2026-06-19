"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Briefcase, Search, Plus, Edit2, Trash2, X, Star, DollarSign, Activity } from 'lucide-react';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBroker, setEditingBroker] = useState<any>(null);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [formMC, setFormMC] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formScore, setFormScore] = useState('A');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    fetchBrokers();
  }, []);

  async function fetchBrokers() {
    setLoading(true);
    // Fetch brokers and their loads to calculate average RPM and load count
    const { data: brokersData, error } = await supabase
      .from('brokers')
      .select('*, loads(rate, loaded_miles)');

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const processed = brokersData.map(b => {
      const totalLoads = b.loads?.length || 0;
      let avgRpm = 0;
      if (totalLoads > 0) {
        let totalRate = 0;
        let totalMiles = 0;
        b.loads.forEach((l: any) => {
           totalRate += Number(l.rate) || 0;
           totalMiles += Number(l.loaded_miles) || 0;
        });
        avgRpm = totalMiles > 0 ? (totalRate / totalMiles) : 0;
      }
      return { ...b, totalLoads, avgRpm };
    });

    setBrokers(processed);
    setLoading(false);
  }

  function openModal(broker: any = null) {
    if (broker) {
      setEditingBroker(broker);
      setFormName(broker.name);
      setFormMC(broker.mc_number || '');
      setFormAddress(broker.address || '');
      setFormPhone(broker.phone || '');
      setFormContact(broker.contact_person || '');
      setFormScore(broker.credit_score || 'A');
      setFormNotes(broker.notes || '');
    } else {
      setEditingBroker(null);
      setFormName('');
      setFormMC('');
      setFormAddress('');
      setFormPhone('');
      setFormContact('');
      setFormScore('A');
      setFormNotes('');
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleSave() {
    if (!formName) {
      alert("Broker Name is required");
      return;
    }

    const payload = {
      name: formName,
      mc_number: formMC,
      address: formAddress,
      phone: formPhone,
      contact_person: formContact,
      credit_score: formScore,
      notes: formNotes
    };

    if (editingBroker) {
      const { error } = await supabase.from('brokers').update(payload).eq('id', editingBroker.id);
      if (!error) {
        fetchBrokers();
        closeModal();
      } else {
        alert("Error updating broker: " + error.message);
      }
    } else {
      const { error } = await supabase.from('brokers').insert([payload]);
      if (!error) {
        fetchBrokers();
        closeModal();
      } else {
        alert("Error adding broker: " + error.message);
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this broker?")) return;
    const { error } = await supabase.from('brokers').delete().eq('id', id);
    if (!error) {
      fetchBrokers();
    } else {
      alert("Error deleting broker: " + error.message);
    }
  }

  function getScoreColor(score: string) {
    switch(score.toUpperCase()) {
      case 'A': return 'text-success bg-success/10 border-success/30';
      case 'B': return 'text-primary bg-primary/10 border-primary/30';
      case 'C': return 'text-warning bg-warning/10 border-warning/30';
      case 'D': return 'text-danger bg-danger/10 border-danger/30';
      default: return 'text-gray-400 bg-white/10 border-white/20';
    }
  }

  const filteredBrokers = brokers.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (b.mc_number && b.mc_number.includes(searchTerm))
  );

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
             <Briefcase className="w-8 h-8 mr-3 text-primary" />
             Brokers Directory
          </h1>
          <p className="text-gray-400 mt-1">Manage brokers, customers, and their average RPM.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search brokers by name or MC..." 
              className="bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 w-72 focus:outline-none focus:border-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center bg-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Broker
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto glass-panel p-6">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredBrokers.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full text-gray-500">
             <Briefcase className="w-16 h-16 mb-4 opacity-20" />
             <p className="text-lg">No brokers found.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredBrokers.map(broker => (
               <div key={broker.id} className="bg-[#111] border border-white/10 hover:border-primary/30 transition rounded-2xl p-5 flex flex-col group relative">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{broker.name}</h3>
                      <div className="text-xs text-gray-500 bg-white/5 inline-block px-2 py-1 rounded">MC: {broker.mc_number || 'N/A'}</div>
                    </div>
                    <div className={`text-lg font-black border px-3 py-1 rounded-lg ${getScoreColor(broker.credit_score || 'A')}`}>
                       {broker.credit_score || 'A'}
                    </div>
                 </div>

                 <div className="space-y-2 mb-6 flex-1">
                    <div className="flex items-center text-sm text-gray-400">
                       <span className="w-20 text-gray-500">Contact:</span>
                       <span className="text-white truncate">{broker.contact_person || '-'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                       <span className="w-20 text-gray-500">Phone:</span>
                       <span className="text-white truncate">{broker.phone || '-'}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                       <div className="text-xs text-gray-500 mb-1 flex items-center"><Activity className="w-3 h-3 mr-1" /> Total Loads</div>
                       <div className="text-lg font-bold text-white">{broker.totalLoads}</div>
                    </div>
                    <div className="bg-success/5 rounded-xl p-3 border border-success/10">
                       <div className="text-xs text-success mb-1 flex items-center"><DollarSign className="w-3 h-3 mr-1" /> Avg RPM</div>
                       <div className="text-lg font-bold text-success">${broker.avgRpm.toFixed(2)}</div>
                    </div>
                 </div>

                 <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-auto">
                    <button onClick={() => openModal(broker)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition" title="Edit">
                       <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(broker.id)} className="p-2 hover:bg-danger/20 rounded-lg text-danger transition" title="Delete">
                       <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                 <h2 className="text-xl font-bold flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-primary" />
                    {editingBroker ? 'Edit Broker' : 'Add New Broker'}
                 </h2>
                 <button onClick={closeModal} className="text-gray-400 hover:text-white transition"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6">
                 <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="col-span-2 md:col-span-1">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Company Name *</label>
                       <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="e.g. TQL, CH Robinson" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                       <label className="text-xs font-bold text-gray-400 block mb-1">MC Number</label>
                       <input type="text" value={formMC} onChange={e => setFormMC(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="e.g. 123456" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Contact Person</label>
                       <input type="text" value={formContact} onChange={e => setFormContact(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="e.g. John Doe" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Phone</label>
                       <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="(123) 456-7890" />
                    </div>
                    <div className="col-span-2">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Address</label>
                       <input type="text" value={formAddress} onChange={e => setFormAddress(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="Full address" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6 mb-6 border-t border-white/10 pt-6">
                    <div className="col-span-2 md:col-span-1">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Credit / Experience Score</label>
                       <select value={formScore} onChange={e => setFormScore(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none appearance-none">
                          <option value="A">A - Excellent (Pays on time, easy to work with)</option>
                          <option value="B">B - Good</option>
                          <option value="C">C - Fair (Requires follow up)</option>
                          <option value="D">D - Poor / Avoid (Late payments, bad rates)</option>
                       </select>
                    </div>
                    <div className="col-span-2">
                       <label className="text-xs font-bold text-gray-400 block mb-1">Internal Notes</label>
                       <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none min-h-[100px]" placeholder="Any specific requirements or history with this broker..." />
                    </div>
                 </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                 <button onClick={closeModal} className="px-6 py-2 rounded-xl font-bold text-gray-400 hover:text-white transition">Cancel</button>
                 <button onClick={handleSave} className="px-6 py-2 rounded-xl font-bold bg-primary text-white hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition">Save Broker</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
