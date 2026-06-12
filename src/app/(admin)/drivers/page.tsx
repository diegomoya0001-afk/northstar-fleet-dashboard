"use client";

import React, { useState, useEffect } from 'react';
import { User, Plus, Search, MapPin, Truck, Phone, Mail, Award, X, Edit2, FileText, Upload, Printer, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DriversPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'on-duty' | 'off-duty'>('all');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [showEditDocModal, setShowEditDocModal] = useState(false);

  // Form states
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCdl, setFormCdl] = useState('');
  const [formStatus, setFormStatus] = useState('active'); // active, off_duty
  const [formTruckId, setFormTruckId] = useState('');
  const [formTrailerId, setFormTrailerId] = useState('');

  // Upload Form states
  const [docType, setDocType] = useState('cdl_copy');
  const [customDocType, setCustomDocType] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit Doc states
  const [editDocId, setEditDocId] = useState('');
  const [editDocName, setEditDocName] = useState('');
  const [editDocExpiry, setEditDocExpiry] = useState('');

  useEffect(() => {
    fetchDrivers();
    fetchAvailableVehicles();
  }, []);

  async function fetchDrivers() {
    setLoading(true);
    const { data: driversData, error } = await supabase
      .from('users')
      .select(`*, vehicles!vehicles_assigned_driver_id_fkey(id, plate_number, unit_number, make, model, type)`)
      .eq('role', 'driver');
    
    if (error) {
      console.error('Error fetching drivers:', error);
    } else {
      setDrivers(driversData || []);
      if (selectedDriver) {
        const updated = driversData?.find(d => d.id === selectedDriver.id);
        if (updated) setSelectedDriver({ ...selectedDriver, ...updated });
      }
    }
    setLoading(false);
  }

  async function fetchAvailableVehicles() {
    const { data, error } = await supabase.from('vehicles').select('id, plate_number, unit_number, make, model, type, assigned_driver_id');
    if (!error && data) {
      setVehicles(data);
    }
  }

  useEffect(() => {
    if (selectedDriver && !selectedDriver.documents) {
      fetchDocuments(selectedDriver.id);
    }
  }, [selectedDriver?.id]);

  async function fetchDocuments(driverId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', 'driver')
      .eq('entity_id', driverId);
    
    if (!error && data) {
      setSelectedDriver((prev: any) => prev ? { ...prev, documents: data } : null);
      setDrivers((prev: any[]) => prev.map(d => d.id === driverId ? { ...d, documents: data } : d));
    }
  }

  function openEditModal(driver: any) {
    setFormFirstName(driver.first_name || '');
    setFormLastName(driver.last_name || '');
    setFormEmail(driver.email || '');
    setFormPhone(driver.phone || '');
    setFormCdl(driver.cdl_number || '');
    setFormStatus(driver.status || 'active');
    
    const assignedTruck = driver.vehicles?.find((v: any) => v.type === 'truck');
    const assignedTrailer = driver.vehicles?.find((v: any) => v.type === 'trailer');
    
    setFormTruckId(assignedTruck ? assignedTruck.id : '');
    setFormTrailerId(assignedTrailer ? assignedTrailer.id : '');
    setShowEditModal(true);
  }

  function resetForm() {
    setFormFirstName(''); setFormLastName(''); setFormEmail(''); setFormPhone(''); 
    setFormCdl(''); setFormStatus('active'); setFormTruckId(''); setFormTrailerId('');
  }

  async function handleCreateDriver() {
    if (!formFirstName || !formLastName || !formEmail) {
      alert('First Name, Last Name, and Email are required.');
      return;
    }

    const newDriver = {
      first_name: formFirstName,
      last_name: formLastName,
      email: formEmail,
      phone: formPhone,
      cdl_number: formCdl,
      status: formStatus,
      role: 'driver'
    };

    const { data, error } = await supabase.from('users').insert([newDriver]).select();

    if (error) {
      console.error('Error adding driver:', error);
      alert('Failed to add driver: ' + error.message);
      return;
    } 
    
    if (data && data.length > 0) {
       const driverId = data[0].id;
       if (formTruckId) await supabase.from('vehicles').update({ assigned_driver_id: driverId }).eq('id', formTruckId);
       if (formTrailerId) await supabase.from('vehicles').update({ assigned_driver_id: driverId }).eq('id', formTrailerId);
    }

    setShowAddModal(false);
    resetForm();
    fetchDrivers();
    fetchAvailableVehicles();
  }

  async function handleUpdateDriver() {
    if (!selectedDriver) return;

    const updatedDriver = {
      first_name: formFirstName,
      last_name: formLastName,
      email: formEmail,
      phone: formPhone,
      cdl_number: formCdl,
      status: formStatus
    };

    const { error } = await supabase.from('users').update(updatedDriver).eq('id', selectedDriver.id);

    if (error) {
      console.error('Error updating driver:', error);
      alert('Failed to update driver: ' + error.message);
      return;
    }

    const assignedTruck = selectedDriver.vehicles?.find((v: any) => v.type === 'truck');
    const assignedTrailer = selectedDriver.vehicles?.find((v: any) => v.type === 'trailer');

    // Handle Truck assignment
    if (formTruckId !== (assignedTruck?.id || '')) {
      if (assignedTruck?.id) {
        await supabase.from('vehicles').update({ assigned_driver_id: null }).eq('id', assignedTruck.id);
      }
      if (formTruckId) {
        await supabase.from('vehicles').update({ assigned_driver_id: selectedDriver.id }).eq('id', formTruckId);
      }
    }

    // Handle Trailer assignment
    if (formTrailerId !== (assignedTrailer?.id || '')) {
      if (assignedTrailer?.id) {
        await supabase.from('vehicles').update({ assigned_driver_id: null }).eq('id', assignedTrailer.id);
      }
      if (formTrailerId) {
        await supabase.from('vehicles').update({ assigned_driver_id: selectedDriver.id }).eq('id', formTrailerId);
      }
    }

    setShowEditModal(false);
    resetForm();
    fetchDrivers();
    fetchAvailableVehicles();
  }

  async function handleUploadDocument() {
    if (!selectedDriver || !docFile) {
      alert('Please select a file.');
      return;
    }

    const finalDocType = docType === 'other' ? (customDocType || 'Other Document') : docType;

    setUploading(true);
    const fileExt = docFile.name.split('.').pop();
    const fileName = `${selectedDriver.id}-${Date.now()}.${fileExt}`;
    const filePath = `${selectedDriver.id}/${fileName}`;

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
      entity_type: 'driver',
      entity_id: selectedDriver.id,
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
      fetchDocuments(selectedDriver.id);
    }
    setUploading(false);
  }

  async function handleDeleteDocument(doc: any) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const filePath = `${selectedDriver.id}/${doc.file_url.split('/').pop()}`;
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocuments(selectedDriver.id);
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
      fetchDocuments(selectedDriver.id);
    } else {
      alert("Failed to update: " + error.message);
    }
  }

  const filteredDrivers = drivers.filter(d => {
    if (activeTab === 'all') return true;
    if (activeTab === 'on-duty') return d.status === 'active';
    if (activeTab === 'off-duty') return d.status !== 'active';
    return true;
  });

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Driver Management</h1>
          <p className="text-gray-400 mt-1">Manage personnel, CDL compliance, and ID cards</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="glass-button px-6 py-3 font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Driver
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className={`glass-panel flex flex-col p-6 overflow-hidden transition-all duration-300 ${selectedDriver ? 'w-1/2' : 'w-full'}`}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'all' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('all')}>All</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'on-duty' ? 'bg-success text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('on-duty')}>On Duty</button>
              <button className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'off-duty' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setActiveTab('off-duty')}>Off Duty</button>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Search by name or CDL..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary/50 text-white" />
            </div>
          </div>

          <div className="flex-1 overflow-auto hide-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading drivers data...</div>
            ) : filteredDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <User className="w-16 h-16 mb-4 opacity-50" />
                <p>No drivers found. Add your first driver to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredDrivers.map((driver) => (
                  <div 
                    key={driver.id} 
                    onClick={() => setSelectedDriver(driver)}
                    className={`bg-white/5 border rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition flex items-center justify-between ${selectedDriver?.id === driver.id ? 'border-primary bg-white/10' : 'border-white/10'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                        <span className="font-bold text-lg">{driver.first_name[0]}{driver.last_name[0]}</span>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-white mr-3">{driver.first_name} {driver.last_name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${driver.status === 'active' ? 'bg-success/20 text-success' : 'bg-gray-500/20 text-gray-400'}`}>
                            {driver.status === 'active' ? 'ON DUTY' : 'OFF DUTY'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 flex items-center mt-1">
                          <Truck className="w-3 h-3 mr-1" /> 
                          {driver.vehicles && driver.vehicles.length > 0 
                            ? driver.vehicles.map((v:any) => v.unit_number || v.plate_number).join(' + ') 
                            : 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedDriver && (
          <div className="glass-panel w-1/2 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                  <span className="font-bold text-xl">{selectedDriver.first_name[0]}{selectedDriver.last_name[0]}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedDriver.first_name} {selectedDriver.last_name}</h2>
                  <div className="text-sm text-gray-400 mt-0.5">CDL: <span className="font-mono text-white">{selectedDriver.cdl_number || 'Pending'}</span></div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setShowIdCardModal(true)} className="p-2 hover:bg-white/10 rounded-lg transition text-white flex items-center text-sm font-semibold border border-white/20">
                  <Printer className="w-4 h-4 mr-2" /> Print ID
                </button>
                <button onClick={() => openEditModal(selectedDriver)} className="p-2 hover:bg-white/10 rounded-lg transition text-primary flex items-center text-sm font-semibold">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </button>
                <button onClick={() => setSelectedDriver(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-8">
              <section>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center">
                    <Phone className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Phone Number</div>
                      <div className="font-medium mt-0.5 text-white">{selectedDriver.phone || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center">
                    <Mail className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Email Address</div>
                      <div className="font-medium mt-0.5 text-white">{selectedDriver.email || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center"><Truck className="w-4 h-4 mr-2"/> Equipment Assignment</h3>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col space-y-3">
                  
                  {/* Truck */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mr-4">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Assigned Truck</div>
                        <div className="font-bold text-lg mt-0.5">
                          {selectedDriver.vehicles?.find((v:any) => v.type === 'truck') ? (
                            `${selectedDriver.vehicles.find((v:any) => v.type === 'truck').make} (${selectedDriver.vehicles.find((v:any) => v.type === 'truck').unit_number || selectedDriver.vehicles.find((v:any) => v.type === 'truck').plate_number})`
                          ) : 'None'}
                        </div>
                      </div>
                    </div>
                    {selectedDriver.vehicles?.find((v:any) => v.type === 'truck') && <CheckCircle className="w-6 h-6 text-success" />}
                  </div>

                  {/* Trailer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mr-4">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Assigned Trailer</div>
                        <div className="font-bold text-lg mt-0.5">
                          {selectedDriver.vehicles?.find((v:any) => v.type === 'trailer') ? (
                            `${selectedDriver.vehicles.find((v:any) => v.type === 'trailer').make} (${selectedDriver.vehicles.find((v:any) => v.type === 'trailer').unit_number || selectedDriver.vehicles.find((v:any) => v.type === 'trailer').plate_number})`
                          ) : 'None'}
                        </div>
                      </div>
                    </div>
                    {selectedDriver.vehicles?.find((v:any) => v.type === 'trailer') && <CheckCircle className="w-6 h-6 text-success" />}
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
                
                {(!selectedDriver.documents || selectedDriver.documents.length === 0) ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400">
                    No documents uploaded. Add CDL, Medical Card, Drug Test, or Application.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDriver.documents.map((doc: any) => {
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

      {/* Add / Edit Driver Modal */}
      {(showAddModal || showEditModal) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{showEditModal ? 'Edit Driver Profile' : 'Register New Driver'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">First Name *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" value={formFirstName} onChange={e => setFormFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Last Name *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" value={formLastName} onChange={e => setFormLastName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email Address *</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="driver@example.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} disabled={showEditModal} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Phone Number</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white" placeholder="(555) 123-4567" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">CDL Number</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white font-mono uppercase" placeholder="TX12345678" value={formCdl} onChange={e => setFormCdl(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Duty Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                    <option value="active" className="bg-[#111]">On Duty (Active)</option>
                    <option value="off_duty" className="bg-[#111]">Off Duty / Vacation</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Assign Truck</label>
                  <select value={formTruckId} onChange={e => setFormTruckId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                    <option value="" className="bg-[#111]">-- No Truck --</option>
                    {vehicles.filter(v => v.type === 'truck').map(v => (
                      <option key={v.id} value={v.id} className="bg-[#111]">{v.unit_number || v.plate_number} ({v.make})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Assign Trailer</label>
                  <select value={formTrailerId} onChange={e => setFormTrailerId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                    <option value="" className="bg-[#111]">-- No Trailer --</option>
                    {vehicles.filter(v => v.type === 'trailer').map(v => (
                      <option key={v.id} value={v.id} className="bg-[#111]">{v.unit_number || v.plate_number} ({v.make})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:text-white mr-4">Cancel</button>
              <button onClick={showEditModal ? handleUpdateDriver : handleCreateDriver} className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-blue-500/30">
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
              <h2 className="text-2xl font-bold">Upload Driver Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-primary/50 outline-none">
                  <option value="cdl_copy" className="bg-[#111]">CDL Copy</option>
                  <option value="medical_exam" className="bg-[#111]">Medical Exam / Card</option>
                  <option value="drug_test" className="bg-[#111]">Drug Test Results</option>
                  <option value="job_application" className="bg-[#111]">Job Application</option>
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

      {/* ID Card Print Modal */}
      {showIdCardModal && selectedDriver && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Company ID Card</h2>
              <button onClick={() => setShowIdCardModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* The ID Card Preview */}
            <div id="id-card-print" className="bg-white rounded-2xl overflow-hidden shadow-2xl relative w-full aspect-[1.6/1] text-black border border-gray-200 mb-8">
              <div className="bg-blue-600 p-4 flex justify-between items-center text-white h-1/3">
                 <div>
                   <h1 className="font-black text-xl tracking-tighter">NorthStar</h1>
                   <p className="text-[0.6rem] font-bold tracking-widest uppercase opacity-80">Freight Logistics LLC</p>
                 </div>
                 <Award className="w-8 h-8 opacity-50" />
              </div>
              
              <div className="p-4 flex">
                 <div className="w-1/3 mr-4">
                    <div className="w-full aspect-[3/4] bg-gray-200 border-2 border-white shadow-sm rounded flex items-center justify-center -mt-8 z-10 relative overflow-hidden">
                       <User className="w-12 h-12 text-gray-400" />
                    </div>
                 </div>
                 <div className="w-2/3 pt-2">
                    <h2 className="text-xl font-black uppercase text-gray-800 leading-tight">{selectedDriver.first_name}</h2>
                    <h2 className="text-xl font-black uppercase text-gray-800 leading-tight">{selectedDriver.last_name}</h2>
                    <p className="text-blue-600 font-bold text-xs mt-1 uppercase tracking-wider">Commercial Driver</p>
                    
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-[0.65rem] border-b border-gray-100 pb-1">
                        <span className="text-gray-400 font-semibold uppercase">ID No.</span>
                        <span className="font-mono font-bold text-gray-700">{selectedDriver.id.split('-')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between text-[0.65rem] border-b border-gray-100 pb-1">
                        <span className="text-gray-400 font-semibold uppercase">CDL</span>
                        <span className="font-mono font-bold text-gray-700">{selectedDriver.cdl_number || 'PENDING'}</span>
                      </div>
                      <div className="flex justify-between text-[0.65rem]">
                        <span className="text-gray-400 font-semibold uppercase">Valid</span>
                        <span className="font-bold text-gray-700">2026 - 2028</span>
                      </div>
                    </div>
                 </div>
              </div>
              <div className="absolute bottom-0 w-full bg-gray-100 py-1.5 px-4 text-center">
                 <p className="text-[0.5rem] text-gray-400 uppercase font-bold tracking-widest">Property of NorthStar Freight Logistics LLC</p>
              </div>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={() => alert("To print this card, we recommend capturing the screen or right-clicking to save the image.")} 
                className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center"
              >
                <Printer className="w-5 h-5 mr-2" /> Download / Print ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
