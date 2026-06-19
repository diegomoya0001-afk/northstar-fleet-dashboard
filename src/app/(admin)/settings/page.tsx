"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Building, Percent, MessageSquare, Save, CheckCircle, ShieldAlert, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PinModal from '@/components/PinModal';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [newPin, setNewPin] = useState('0000');
  const [newModules, setNewModules] = useState<string[]>(['loads', 'drivers', 'fleet']);

  const [dispatchers, setDispatchers] = useState<any[]>([]);
  const [dispatcherToDelete, setDispatcherToDelete] = useState<string | null>(null);
  const [newDispatcherFirstName, setNewDispatcherFirstName] = useState('');
  const [newDispatcherLastName, setNewDispatcherLastName] = useState('');
  const [newDispatcherCommission, setNewDispatcherCommission] = useState('5');
  const [newDispatcherCompany, setNewDispatcherCompany] = useState('');
  const [newDispatcherPaymentInfo, setNewDispatcherPaymentInfo] = useState('');
  const [newDispatcherIdNumber, setNewDispatcherIdNumber] = useState('');

  const [settings, setSettings] = useState({
    id: '',
    company_name: 'Northstar Freight Logistics',
    dispatcher_fee_percent: 10,
    factoring_fee_percent: 2.5,
    factoring_ach_fee: 5,
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    security_pin: '1234',
    motive_api_key: ''
  });

  const MODULES_LIST = [
    { id: 'fleet', label: 'Fleet' },
    { id: 'drivers', label: 'Drivers' },
    { id: 'logs', label: 'Logs' },
    { id: 'loads', label: 'Loads' },
    { id: 'brokers', label: 'Brokers' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'fuel-logs', label: 'Fuel Logs' },
    { id: 'financials', label: 'Financials' },
    { id: 'ifta', label: 'IFTA' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'settings', label: 'Settings' }
  ];

  useEffect(() => {
    fetchSettings();
    fetchUsersList();
    fetchDispatchers();
  }, []);

  async function fetchUsersList() {
    const { data } = await supabase.from('users').select('*').neq('role', 'dispatcher').order('role').order('first_name');
    if (data) setUsersList(data);
  }

  async function handleAddUser() {
    if (!newFirstName || !newLastName) return;
    const { error } = await supabase.from('users').insert([{
      first_name: newFirstName,
      last_name: newLastName,
      email: `${newFirstName.toLowerCase()}.${newLastName.toLowerCase()}@northstar.local`,
      role: newRole,
      status: 'active',
      security_pin: newPin,
      module_access: newRole === 'manager' ? ['all'] : newModules
    }]);
    if (!error) {
      setNewFirstName('');
      setNewLastName('');
      setNewRole('dispatcher');
      setNewPin('0000');
      setNewModules(['loads', 'drivers', 'fleet']);
      fetchUsersList();
    } else {
      alert("Error adding user: " + error.message);
    }
  }

  function handleDeleteUser(id: string) {
    setUserToDelete(id);
    setShowPinModal(true);
  }

  async function handleConfirmDeleteUser() {
    if (!userToDelete) return;
    const { error } = await supabase.from('users').delete().eq('id', userToDelete);
    if (!error) {
       fetchUsersList();
    } else {
       alert("Error deleting: " + error.message);
    }
    setShowPinModal(false);
    setUserToDelete(null);
  }

  async function handleUpdatePin(id: string, newPinValue: string) {
    const { error } = await supabase.from('users').update({ security_pin: newPinValue }).eq('id', id);
    if (!error) {
      fetchUsersList();
    } else {
      alert("Error updating PIN: " + error.message);
    }
  }

  async function fetchDispatchers() {
    const { data } = await supabase.from('users').select('*').eq('role', 'dispatcher');
    if (data) setDispatchers(data);
  }

  async function handleAddDispatcher() {
    if (!newDispatcherFirstName || !newDispatcherLastName) return;
    const { error } = await supabase.from('users').insert([{
      first_name: newDispatcherFirstName,
      last_name: newDispatcherLastName,
      email: `${newDispatcherFirstName.toLowerCase()}.${newDispatcherLastName.toLowerCase()}@dispatch.local`,
      role: 'dispatcher',
      status: 'active',
      commission_rate: parseFloat(newDispatcherCommission) || 5,
      company_name: newDispatcherCompany,
      payment_info: newDispatcherPaymentInfo,
      dispatcher_id_number: newDispatcherIdNumber
    }]);
    if (!error) {
      setNewDispatcherFirstName('');
      setNewDispatcherLastName('');
      setNewDispatcherCommission('5');
      setNewDispatcherCompany('');
      setNewDispatcherPaymentInfo('');
      setNewDispatcherIdNumber('');
      fetchDispatchers();
    } else {
      alert("Error adding dispatcher: " + error.message);
    }
  }

  function handleDeleteDispatcher(id: string) {
    setDispatcherToDelete(id);
    setShowPinModal(true);
  }

  async function handleConfirmDeleteDispatcher() {
    if (!dispatcherToDelete) return;
    const { error } = await supabase.from('users').delete().eq('id', dispatcherToDelete);
    if (!error) {
       fetchDispatchers();
    } else {
       alert("Error deleting: " + error.message);
    }
    setShowPinModal(false);
    setDispatcherToDelete(null);
  }

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (data) {
      setSettings(data);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);

    let error;
    if (settings.id) {
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          dispatcher_fee_percent: settings.dispatcher_fee_percent,
          factoring_fee_percent: settings.factoring_fee_percent,
          factoring_ach_fee: settings.factoring_ach_fee,
          twilio_account_sid: settings.twilio_account_sid,
          twilio_auth_token: settings.twilio_auth_token,
          twilio_phone_number: settings.twilio_phone_number,
          security_pin: settings.security_pin,
          motive_api_key: settings.motive_api_key,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('company_settings')
        .insert([{
          company_name: settings.company_name,
          dispatcher_fee_percent: settings.dispatcher_fee_percent,
          factoring_fee_percent: settings.factoring_fee_percent,
          factoring_ach_fee: settings.factoring_ach_fee,
          twilio_account_sid: settings.twilio_account_sid,
          twilio_auth_token: settings.twilio_auth_token,
          twilio_phone_number: settings.twilio_phone_number,
          security_pin: settings.security_pin,
          motive_api_key: settings.motive_api_key
        }]);
      error = insertError;
    }

    if (!error) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchSettings(); // Refresh ID if it was inserted
    } else {
      alert("Error saving settings: " + error.message);
    }
    setSaving(false);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-white flex items-center tracking-tight mb-2">
            <Settings className="w-10 h-10 mr-4 text-primary" />
            General Settings
          </h1>
          <p className="text-gray-400 font-medium">Manage company profile, financial defaults, and SMS integrations</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : success ? <><CheckCircle className="w-5 h-5 mr-2" /> Saved!</> : <><Save className="w-5 h-5 mr-2" /> Save Changes</>}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading settings...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Company Profile */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Building className="w-6 h-6 mr-3 text-blue-400" />
              Company Profile
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Company Name</label>
                <input 
                  type="text" 
                  name="company_name"
                  value={settings.company_name}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition"
                  placeholder="e.g. Northstar Freight Logistics"
                />
              </div>
              <p className="text-xs text-gray-500 font-medium mt-2">This name will appear on all exported DOT Logs and DVIRs.</p>
            </div>
          </div>

          {/* Financial Defaults */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Percent className="w-6 h-6 mr-3 text-green-400" />
              Financial Defaults
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Dispatcher Fee (%)</label>
                <input 
                  type="number" 
                  name="dispatcher_fee_percent"
                  value={settings.dispatcher_fee_percent}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Factoring Fee (%)</label>
                <input 
                  type="number" 
                  name="factoring_fee_percent"
                  step="0.1"
                  value={settings.factoring_fee_percent}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition"
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Factoring ACH Fee ($)</label>
                <input 
                  type="number" 
                  name="factoring_ach_fee"
                  step="0.1"
                  value={settings.factoring_ach_fee}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition"
                  placeholder="5"
                />
              </div>
              <p className="text-xs text-gray-500 font-medium mt-2">These amounts are automatically deducted when calculating load net profit.</p>
            </div>
          </div>

          {/* Security Defaults */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl md:col-span-2">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <ShieldAlert className="w-6 h-6 mr-3 text-red-500" />
              Security Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Master Security PIN</label>
                <input 
                  type="password" 
                  name="security_pin"
                  maxLength={4}
                  value={settings.security_pin}
                  onChange={(e) => setSettings(prev => ({ ...prev, security_pin: e.target.value.replace(/\D/g, '') }))}
                  className="w-48 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-2xl tracking-widest text-center focus:outline-none focus:border-red-500 transition"
                  placeholder="1234"
                />
              </div>
              <p className="text-xs text-gray-500 font-medium mt-2">This 4-digit PIN is required to delete sensitive data like Shop Visits or Payroll records.</p>
            </div>
          </div>

          {/* Twilio SMS Integration */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl md:col-span-2">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <MessageSquare className="w-6 h-6 mr-3 text-purple-400" />
              Twilio SMS Integration
            </h2>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6 flex items-start">
              <ShieldAlert className="w-5 h-5 text-purple-400 mr-3 mt-0.5" />
              <p className="text-sm text-gray-300">
                To send automated SMS notifications to drivers when they are assigned a load, you must provide your Twilio API credentials. If left blank, the system will simulate sending SMS in the console.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Account SID</label>
                <input 
                  type="text" 
                  name="twilio_account_sid"
                  value={settings.twilio_account_sid || ''}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Auth Token</label>
                <input 
                  type="password" 
                  name="twilio_auth_token"
                  value={settings.twilio_auth_token || ''}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                  placeholder="••••••••••••••••••••••••••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Twilio Phone Number</label>
                <input 
                  type="text" 
                  name="twilio_phone_number"
                  value={settings.twilio_phone_number || ''}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                  placeholder="+1234567890"
                />
              </div>
            </div>
          </div>

          {/* Motive API Integration */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl md:col-span-2 mt-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              Motive ELD Integration
            </h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-start">
              <ShieldAlert className="w-5 h-5 text-blue-400 mr-3 mt-0.5" />
              <p className="text-sm text-gray-300">
                Enter your Motive API Key to enable live GPS tracking, HOS logs synchronization, and vehicle telemetry. You can generate this key in the Motive Fleet Dashboard under Admin &gt; Developers &gt; Create API Key.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Motive API Key</label>
                <input 
                  type="password" 
                  name="motive_api_key"
                  value={settings.motive_api_key || ''}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                  placeholder="Paste your Motive API Key here"
                />
              </div>
            </div>
          </div>

          {/* Manage Users & Permissions */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl md:col-span-2 mt-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-success" />
              Manage Users & Permissions
            </h2>
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-6 flex items-start">
              <ShieldAlert className="w-5 h-5 text-success mr-3 mt-0.5" />
              <p className="text-sm text-gray-300">
                Create new administrative users, manage their security PINs, and define exactly which modules they have access to. Drivers are also listed here to manage their PINs.
              </p>
            </div>
            
            <div className="bg-black/30 border border-white/10 rounded-xl p-6 mb-8">
              <h3 className="text-md font-bold text-white mb-4">Create New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">First Name *</label>
                  <input 
                    type="text" 
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Last Name *</label>
                  <input 
                    type="text" 
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Role *</label>
                  <select 
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition appearance-none"
                  >
                    <option value="dispatcher">Dispatcher</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager (Super Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Initial PIN *</label>
                  <input 
                    type="text" 
                    maxLength={4}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                    placeholder="0000"
                  />
                </div>
              </div>

              {newRole !== 'manager' && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Module Access Checklist</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MODULES_LIST.map(mod => (
                      <label key={mod.id} className="flex items-center space-x-2 cursor-pointer bg-white/5 p-2 rounded-lg border border-white/5 hover:bg-white/10 transition">
                        <input 
                          type="checkbox" 
                          checked={newModules.includes(mod.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewModules([...newModules, mod.id]);
                            } else {
                              setNewModules(newModules.filter(m => m !== mod.id));
                            }
                          }}
                          className="form-checkbox text-success rounded focus:ring-success bg-black border-white/20"
                        />
                        <span className="text-sm text-gray-300">{mod.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button 
                  onClick={handleAddUser}
                  className="px-6 py-3 bg-success text-white font-bold rounded-xl hover:bg-green-600 transition flex items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create User
                </button>
              </div>
            </div>

            {usersList.length > 0 ? (
              <div className="space-y-3">
                {usersList.map(u => (
                  <div key={u.id} className="grid grid-cols-1 lg:grid-cols-4 items-center bg-black/40 border border-white/5 p-4 rounded-xl gap-4">
                    <div className="flex flex-col">
                      <div className="font-bold text-white flex items-center">
                         {u.first_name} {u.last_name}
                         <span className={`ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${u.role === 'manager' ? 'bg-purple-500/20 text-purple-400' : u.role === 'driver' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                           {u.role}
                         </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                         {u.email}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Module Access</label>
                       <div className="flex flex-wrap gap-1">
                         {u.role === 'manager' || u.module_access?.includes('all') ? (
                           <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-md">Full Access</span>
                         ) : u.role === 'driver' ? (
                           <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">Driver App Only</span>
                         ) : (
                           u.module_access?.map((mod: string) => (
                             <span key={mod} className="text-[10px] bg-white/10 text-gray-300 px-2 py-1 rounded-md capitalize">
                               {mod.replace('-', ' ')}
                             </span>
                           ))
                         )}
                       </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <div className="flex flex-col items-end">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">PIN</label>
                        <input 
                          type="text" 
                          maxLength={4}
                          defaultValue={u.security_pin || '0000'}
                          onBlur={(e) => {
                            if (e.target.value !== u.security_pin && e.target.value.length === 4) {
                              handleUpdatePin(u.id, e.target.value);
                            }
                          }}
                          className="w-16 bg-black border border-white/20 rounded-md px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      {u.id !== settings.id && u.role !== 'manager' && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-danger hover:text-red-400 p-2 bg-danger/10 rounded-lg transition mt-4 lg:mt-0"
                          title="Delete User"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No users found.</p>
            )}
          </div>

          {/* Manage Dispatchers */}
          <div className="bg-[#111] p-8 rounded-3xl border border-white/5 shadow-2xl md:col-span-2 mt-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Building className="w-6 h-6 mr-3 text-success" />
              Manage Dispatchers
            </h2>
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-6 flex items-start">
              <CheckCircle className="w-5 h-5 text-success mr-3 mt-0.5" />
              <p className="text-sm text-gray-300">
                Add your external dispatchers here so you can assign them to loads and track their individual performance and commissions in the Financials tab. They will not have login access to the system.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">First Name *</label>
                <input 
                  type="text" 
                  value={newDispatcherFirstName}
                  onChange={e => setNewDispatcherFirstName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Last Name *</label>
                <input 
                  type="text" 
                  value={newDispatcherLastName}
                  onChange={e => setNewDispatcherLastName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                  placeholder="Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Dispatcher ID</label>
                <input 
                  type="text" 
                  value={newDispatcherIdNumber}
                  onChange={e => setNewDispatcherIdNumber(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                  placeholder="DISP-001"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Company Name</label>
                <input 
                  type="text" 
                  value={newDispatcherCompany}
                  onChange={e => setNewDispatcherCompany(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                  placeholder="Elite Dispatch LLC"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Payment Info (PayPal, Zelle)</label>
                <input 
                  type="text" 
                  value={newDispatcherPaymentInfo}
                  onChange={e => setNewDispatcherPaymentInfo(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                  placeholder="paypal.me/elitedispatch"
                />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Commission (%) *</label>
                  <input 
                    type="number" 
                    value={newDispatcherCommission}
                    onChange={e => setNewDispatcherCommission(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-success transition"
                    placeholder="5"
                  />
                </div>
                <button 
                  onClick={handleAddDispatcher}
                  className="px-6 py-3 bg-success text-white font-bold rounded-xl hover:bg-green-600 transition h-[50px]"
                >
                  Add
                </button>
              </div>
            </div>

            {dispatchers.length > 0 ? (
              <div className="space-y-3">
                {dispatchers.map(d => (
                  <div key={d.id} className="grid grid-cols-1 sm:grid-cols-3 items-center bg-black/40 border border-white/5 p-4 rounded-xl gap-4">
                    <div className="flex flex-col">
                      <div className="font-bold text-white flex items-center">
                         {d.first_name} {d.last_name}
                         {d.dispatcher_id_number && <span className="ml-2 text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{d.dispatcher_id_number}</span>}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                         {d.company_name ? d.company_name : 'Independent'}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-sm text-gray-300">
                       <div className="font-bold text-success">{d.commission_rate}% Commission</div>
                       <div className="text-xs text-gray-500 mt-1">Pay: {d.payment_info || 'Not provided'}</div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => handleDeleteDispatcher(d.id)}
                        className="text-danger hover:text-red-400 px-4 py-2 bg-danger/10 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No external dispatchers added yet.</p>
            )}
          </div>

        </div>
      )}

      <PinModal 
        isOpen={showPinModal} 
        onClose={() => { setShowPinModal(false); setUserToDelete(null); }} 
        onSuccess={handleConfirmDeleteUser}
        actionText="delete this user profile"
      />
    </div>
  );
}
