"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Truck, User, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.from('users').select(`*, vehicles!vehicles_assigned_driver_id_fkey(unit_number)`).order('first_name');
      if (!error && data) {
        setUsers(data);
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const handleLogin = (user: any) => {
    // Save to localStorage
    localStorage.setItem('fleet_user_id', user.id);
    localStorage.setItem('fleet_user_role', user.role);
    localStorage.setItem('fleet_user_name', `${user.first_name} ${user.last_name}`);

    if (user.role === 'driver') {
      router.push('/driver-app');
    } else {
      router.push('/');
    }
  };

  const handleAdminClick = (user: any) => {
    setSelectedAdmin(user);
    setShowPinModal(true);
  };

  const handlePinSubmit = () => {
    if (pinCode === '0000') {
      setShowPinModal(false);
      handleLogin(selectedAdmin);
    } else {
      alert('Incorrect PIN');
      setPinCode('');
    }
  };

  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'dispatcher');
  const displayAdmins = adminUsers.length > 0 ? adminUsers : [{
    id: 'default-admin',
    first_name: 'Diego',
    last_name: '(System Admin)',
    role: 'admin'
  }];

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[#111] p-8 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">FleetHQ</h1>
          <p className="text-gray-400 mt-2 text-sm">Select a profile to continue</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading users...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Admin / Dispatchers</h3>
              <div className="space-y-2">
                {displayAdmins.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => handleAdminClick(u)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mr-3">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-gray-400 capitalize">Secure Access</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-primary transition" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Drivers</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 hide-scrollbar">
                {users.filter(u => u.role === 'driver').map(u => (
                  <button 
                    key={u.id}
                    onClick={() => handleLogin(u)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-success/20 hover:border-success/50 transition group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mr-3">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-gray-400">Truck: {u.vehicles?.[0]?.unit_number || 'Unassigned'}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-success transition" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PIN Code Modal */}
      {showPinModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-white">Admin Access</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your 4-digit PIN to continue</p>
              
              <input 
                type="password" 
                maxLength={4}
                autoFocus
                placeholder="••••"
                className="w-32 bg-white/5 border border-white/10 rounded-xl p-4 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-primary/50 mx-auto mb-6 block"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              />

              <div className="flex gap-3">
                 <button onClick={() => { setShowPinModal(false); setPinCode(''); }} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition">Cancel</button>
                 <button onClick={handlePinSubmit} className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-primary hover:bg-blue-500 transition shadow-[0_0_15px_rgba(59,130,246,0.5)]">Unlock</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
