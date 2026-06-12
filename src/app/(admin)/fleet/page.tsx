"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Plus, FileText, Settings, Search, MapPin, User, ChevronRight, X, AlertCircle, Edit2, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function FleetPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'trucks' | 'trailers'>('all');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditDocModal, setShowEditDocModal] = useState(false);

  // Add/Edit Form states
  const [formType, setFormType] = useState('truck');
  const [formUnitNumber, setFormUnitNumber] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formVin, setFormVin] = useState('');
  const [formMake, setFormMake] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  // Upload Form states
  const [docType, setDocType] = useState('registration');
  const [customDocType, setCustomDocType] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit Doc states
  const [editDocId, setEditDocId] = useState('');
  const [editDocName, setEditDocName] = useState('');
  const [editDocExpiry, setEditDocExpiry] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('vehicles')
      .select(`*, users(first_name, last_name)`);
    
    if (error) {
      console.error('Error fetching vehicles:', error);
    } else {
      setVehicles(data || []);
      if (selectedVehicle) {
        const updated = data?.find(v => v.id === selectedVehicle.id);
        if (updated) setSelectedVehicle({ ...selectedVehicle, ...updated });
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedVehicle && !selectedVehicle.documents) {
      fetchDocuments(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  async function fetchDocuments(vehicleId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', 'vehicle')
      .eq('entity_id', vehicleId);
    
    if (!error && data) {
      setSelectedVehicle((prev: any) => prev ? { ...prev, documents: data } : null);
      setVehicles((prev: any[]) => prev.map(v => v.id === vehicleId ? { ...v, documents: data } : v));
    }
  }

  function openEditModal(vehicle: any) {
    setFormType(vehicle.type);
    setFormUnitNumber(vehicle.unit_number || '');
    setFormPlate(vehicle.plate_number || '');
    setFormVin(vehicle.vin || '');
    setFormMake(vehicle.make || '');
    setFormModel(vehicle.model || '');
    setFormYear(vehicle.year?.toString() || '');
    setFormStatus(vehicle.status || 'active');
    setShowEditModal(true);
  }

  async function handleCreateVehicle() {
    if (!formVin || !formMake || !formModel || !formYear) {
      alert('Please fill out all required fields');
      return;
    }

    const newVehicle = {
      unit_number: formUnitNumber,
      vin: formVin,
      plate_number: formPlate,
      type: formType,
      make: formMake,
      model: formModel,
      year: parseInt(formYear),
      status: formStatus
    };

    const { error } = await supabase.from('vehicles').insert([newVehicle]);

    if (error) {
      console.error('Error adding vehicle:', error);
      alert('Failed to add vehicle: ' + error.message);
    } else {
      setShowAddModal(false);
      resetForm();
      fetchVehicles();
    }
  }

  async function handleUpdateVehicle() {
    if (!selectedVehicle) return;

    const updatedVehicle = {
      unit_number: formUnitNumber,
      vin: formVin,
      plate_number: formPlate,
      type: formType,
      make: formMake,
      model: formModel,
      year: parseInt(formYear),
      status: formStatus
    };

    const { error } = await supabase.from('vehicles').update(updatedVehicle).eq('id', selectedVehicle.id);

    if (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle: ' + error.message);
    } else {
      setShowEditModal(false);
      resetForm();
      fetchVehicles();
    }
  }

  async function handleUploadDocument() {
    if (!selectedVehicle || !docFile) {
      alert('Please select a file.');
      return;
    }

    const finalDocType = docType === 'other' ? (customDocType || 'Other Document') : docType;

    setUploading(true);
    const fileExt = docFile.name.split('.').pop();
    const fileName = `${selectedVehicle.id}-${Date.now()}.${fileExt}`;
    const filePath = `${selectedVehicle.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, docFile);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

    const { error: dbError } = await supabase.from('documents').insert([{
      entity_type: 'vehicle',
      entity_id: selectedVehicle.id,
      doc_type: finalDocType,
      file_url: publicUrl,
      expiry_date: docExpiry || null,
      notes: docFile.name
    }]);

    if (dbError) {
      console.error('DB error:', dbError);
      alert('Failed to save document record: ' + dbError.message);
    } else {
      setShowUploadModal(false);
      setDocFile(null);
      setDocExpiry('');
      setCustomDocType('');
      fetchDocuments(selectedVehicle.id);
    }
    setUploading(false);
  }

  async function handleDeleteDocument(doc: any) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const filePath = `${selectedVehicle.id}/${doc.file_url.split('/').pop()}`;
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocuments(selectedVehicle.id);
  }

  function openEditDocModal(doc: any) {
    setEditDocId(doc.id);
    setEditDocName(doc.doc_type || '');
    setEditDocExpiry(doc.expiry_date || '');
    setShowEditDocModal(true);
  }

  async function handleEditDocument() {
    const { error } = await supabase.from('documents').update({ 
      expiry_date: editDocExpiry || null,
      doc_type: editDocName
    }).eq('id', editDocId);
    
    if (!error) {
      setShowEditDocModal(false);
      fetchDocuments(selectedVehicle.id);
    } else {
      alert("Failed to update: " + error.message);
    }
  }

  function resetForm() {
    setFormUnitNumber(''); setFormVin(''); setFormPlate(''); setFormMake(''); setFormModel(''); setFormYear(''); setFormStatus('active');
  }

  const filteredFleet = vehicles.filter(v => activeTab === 'all' ? true : v.type === activeTab.slice(0, -1));

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Management</h1>
          <p className="text-gray-400 mt-1">Manage trucks, trailers, assignments and compliance documents</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="glass-button px-6 py-3 font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Vehicle
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className={`glass-panel flex flex-col p-6 overflow-hidden transition-all duration-300 ${selectedVehicle ? 'w-1/2' : 'w-full'}`}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'all' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('all')}>All</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'trucks' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('trucks')}>Trucks</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'trailers' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('trailers')}>Trailers</button>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Search Unit ID or VIN..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary/50 text-white" />
            </div>
          </div>

          <div className="flex-1 overflow-auto hide-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading fleet data from database...</div>
            ) : filteredFleet.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Truck className="w-16 h-16 mb-4 opacity-50" />
                <p>No vehicles found. Add your first vehicle to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredFleet.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`bg-white/5 border rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition flex items-center justify-between ${selectedVehicle?.id === vehicle.id ? 'border-primary bg-white/10' : 'border-white/10'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${vehicle.type === 'truck' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-white mr-3">{vehicle.unit_number || vehicle.plate_number || 'Unnamed Unit'}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${vehicle.status === 'active' ? 'bg-success/20 text-success' : vehicle.status === 'maintenance' ? 'bg-warning/20 text-warning' : 'bg-red-500/20 text-red-400'}`}>
                            {vehicle.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">{vehicle.year} {vehicle.make} {vehicle.model} • VIN: {vehicle.vin.substring(0, 8)}...</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedVehicle && (
          <div className="glass-panel w-1/2 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedVehicle.type === 'truck' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedVehicle.unit_number || selectedVehicle.plate_number || 'Unnamed Unit'} Profile</h2>
                  <div className="text-xs text-gray-400 uppercase">{selectedVehicle.type}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => openEditModal(selectedVehicle)} className="p-2 hover:bg-white/10 rounded-lg transition text-primary flex items-center text-sm font-semibold">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </button>
                <button onClick={() => setSelectedVehicle(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-8">
              <section>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center"><Settings className="w-4 h-4 mr-2"/> Specs & Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-500">VIN Number</div>
                    <div className="font-mono text-sm mt-1 break-all">{selectedVehicle.vin}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-500">License Plate</div>
                    <div className="font-bold mt-1">{selectedVehicle.plate_number || 'N/A'}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-500">Make / Model / Year</div>
                    <div className="font-bold mt-1">{selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.year})</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-500">Status</div>
                    <div className={`font-bold mt-1 uppercase ${selectedVehicle.status === 'active' ? 'text-success' : selectedVehicle.status === 'maintenance' ? 'text-warning' : 'text-red-400'}`}>
                      {selectedVehicle.status}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center"><MapPin className="w-4 h-4 mr-2"/> Operations</h3>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center text-gray-300">
                      <User className="w-5 h-5 mr-3 text-gray-500" />
                      Assigned Driver
                    </div>
                    <div className="font-bold text-white">
                      {selectedVehicle.users ? `${selectedVehicle.users.first_name} ${selectedVehicle.users.last_name}` : 'Unassigned'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-300">
                      <MapPin className="w-5 h-5 mr-3 text-gray-500" />
                      Last Known Location
                    </div>
                    <div className="font-medium text-white">
                      {selectedVehicle.current_location_lat ? `${selectedVehicle.current_location_lat.toFixed(4)}, ${selectedVehicle.current_location_lng.toFixed(4)}` : 'Unknown'}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center"><FileText className="w-4 h-4 mr-2"/> Document Vault</h3>
                  <button onClick={() => setShowUploadModal(true)} className="text-xs font-bold text-primary hover:text-white transition bg-primary/10 px-3 py-1.5 rounded-lg flex items-center">
                    <Upload className="w-3 h-3 mr-1" /> Add Document
                  </button>
                </div>
                
                {(!selectedVehicle.documents || selectedVehicle.documents.length === 0) ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400">
                    No documents uploaded yet. Add registration, insurance, or inspection PDFs.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedVehicle.documents.map((doc: any) => {
                      const isExpiringSoon = doc.expiry_date && new Date(doc.expiry_date).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
                      return (
                        <div key={doc.id} className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10 hover:bg-white/5 transition group">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center mr-4">
                              <FileText className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <div className="font-bold text-sm uppercase">{doc.doc_type.replace(/_/g, ' ')}</div>
                              <div className={`text-xs mt-1 ${isExpiringSoon ? 'text-warning' : 'text-gray-500'}`}>
                                Expires: {doc.expiry_date || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 opacity-100">
                            <button onClick={() => openEditDocModal(doc)} className="text-gray-400 hover:text-primary p-2 transition" title="Edit Expiration Date">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteDocument(doc)} className="text-gray-400 hover:text-red-400 p-2 transition" title="Delete Document">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline ml-2 px-3 py-1 bg-primary/10 rounded-lg">View</a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Edit Document Modal */}
      {showEditDocModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4">Edit Document Details</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Document Name</label>
                <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50" value={editDocName} onChange={e => setEditDocName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Expiration Date</label>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50" value={editDocExpiry} onChange={e => setEditDocExpiry(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowEditDocModal(false)} className="px-4 py-2 text-gray-400 hover:text-white mr-2 font-bold">Cancel</button>
              <button onClick={handleEditDocument} className="px-6 py-2 bg-primary text-white rounded-lg font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {(showAddModal || showEditModal) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{showEditModal ? 'Edit Vehicle Profile' : 'Register New Vehicle'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex space-x-4 mb-6">
                <label className="flex-1 cursor-pointer">
                  <input type="radio" name="vtype" className="peer sr-only" checked={formType === 'truck'} onChange={() => setFormType('truck')} />
                  <div className="p-4 border border-white/20 rounded-xl text-center peer-checked:bg-primary/20 peer-checked:border-primary peer-checked:text-primary transition font-bold">
                    🚚 Truck
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input type="radio" name="vtype" className="peer sr-only" checked={formType === 'trailer'} onChange={() => setFormType('trailer')} />
                  <div className="p-4 border border-white/20 rounded-xl text-center peer-checked:bg-purple-500/20 peer-checked:border-purple-500 peer-checked:text-purple-400 transition font-bold">
                    📦 Trailer
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Status (Operational Condition)</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                    <option value="active" className="bg-[#111]">Active (On Road)</option>
                    <option value="maintenance" className="bg-[#111]">Maintenance (Shop)</option>
                    <option value="out_of_service" className="bg-[#111]">Out of Service</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-primary font-bold block mb-1">Unit ID / Number *</label>
                  <input type="text" className="w-full bg-primary/10 border border-primary/30 rounded-lg p-3 text-white font-bold" placeholder="TRK 01" value={formUnitNumber} onChange={e => setFormUnitNumber(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">License Plate</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="TX-12345" value={formPlate} onChange={e => setFormPlate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Year *</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="2024" value={formYear} onChange={e => setFormYear(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">VIN Number *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white font-mono uppercase" placeholder="1FUJGH..." value={formVin} onChange={e => setFormVin(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Make *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="Freightliner" value={formMake} onChange={e => setFormMake(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Model *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="Cascadia" value={formModel} onChange={e => setFormModel(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button onClick={showEditModal ? handleUpdateVehicle : handleCreateVehicle} className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30">
                {showEditModal ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                  <option value="registration" className="bg-[#111]">Registration (Cab Card)</option>
                  <option value="insurance" className="bg-[#111]">Insurance</option>
                  <option value="annual_inspection" className="bg-[#111]">Annual DOT Inspection</option>
                  <option value="ifta" className="bg-[#111]">IFTA License</option>
                  <option value="other" className="bg-[#111]">Other (Specify)</option>
                </select>
              </div>

              {docType === 'other' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs text-primary block mb-1">Custom Document Name *</label>
                  <input type="text" placeholder="e.g. Record Driver" className="w-full bg-primary/10 border border-primary/30 rounded-lg p-3 text-white focus:outline-none focus:border-primary" value={customDocType} onChange={e => setCustomDocType(e.target.value)} />
                </div>
              )}
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Expiration Date (Optional)</label>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" value={docExpiry} onChange={e => setDocExpiry(e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">File (PDF, JPG, PNG)</label>
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/5 transition cursor-pointer">
                  <input type="file" onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => setShowUploadModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button onClick={handleUploadDocument} disabled={uploading} className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30 disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Save to Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
