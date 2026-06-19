"use client";

import React, { useEffect, useState } from 'react';
import { Truck, MapPin, AlertTriangle, TrendingUp, DollarSign, Activity, Navigation, CheckCircle2, Package, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    activeLoads: 0,
    deliveredLoads: 0,
    totalDrivers: 0,
    maintenanceAlerts: 0
  });
  const [activeDrivers, setActiveDrivers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      // Fetch Loads
      const { data: loads } = await supabase.from('loads').select('*');
      // Fetch Drivers
      const { data: drivers } = await supabase.from('users').select('*').eq('role', 'driver');
      // Fetch Vehicles
      const { data: vehicles } = await supabase.from('vehicles').select('*');
      // Fetch Inspections for alerts
      const { data: inspections } = await supabase.from('inspections').select('*').in('status', ['failed', 'passed_with_defect']);

      let rev = 0;
      let active = 0;
      let delivered = 0;

      if (loads) {
         loads.forEach(l => {
            if (['delivered', 'invoiced', 'paid'].includes(l.status)) {
               rev += Number(l.rate || 0);
               delivered++;
            } else if (['dispatched', 'at_pickup', 'in_transit', 'at_delivery'].includes(l.status)) {
               active++;
            }
         });
      }

      setStats({
        revenue: rev,
        activeLoads: active,
        deliveredLoads: delivered,
        totalDrivers: drivers?.length || 0,
        maintenanceAlerts: inspections?.length || 0
      });

      // Match active loads to drivers
      if (drivers && loads) {
        const busyDrivers = drivers.map(d => {
           const currentLoad = loads.find(l => l.assigned_driver_id === d.id && ['dispatched', 'at_pickup', 'in_transit', 'at_delivery'].includes(l.status));
           const currentVehicle = vehicles?.find(v => v.assigned_driver_id === d.id);
           return {
              ...d,
              currentLoad,
              currentVehicle
           };
        }).filter(d => d.currentLoad); // only show drivers with loads

        // If no busy drivers, just show a couple of idle ones
        if (busyDrivers.length === 0) {
           setActiveDrivers(drivers.slice(0, 3).map(d => ({...d, currentLoad: null, currentVehicle: vehicles?.find(v => v.assigned_driver_id === d.id)})));
        } else {
           setActiveDrivers(busyDrivers);
        }
      }

      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  return (
    <div className="h-full flex flex-col gap-6 relative overflow-hidden">
      {/* Header section */}
      <header className="flex justify-between items-center px-2 relative z-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-gray-400 mt-1">Live Fleet Overview</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="glass-panel px-4 py-2 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_#00C853]" />
            <span className="text-sm font-medium tracking-wide">All Systems Operational</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            NS
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 relative z-10">
        
        {/* Main Tech Widget (Left Column) */}
        <div className="col-span-12 lg:col-span-8 glass-panel border border-white/5 flex flex-col relative overflow-hidden group rounded-3xl shadow-2xl">
          {/* Ultra Modern CSS Background */}
          <div className="absolute inset-0 bg-[#030712] overflow-hidden">
             {/* Glowing Grid */}
             <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
             {/* Radial gradient mask for grid */}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030712]/50 to-[#030712]"></div>
             
             {/* Animated glowing orbs */}
             <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
             <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{animationDelay: '2s'}}></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full"></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full border-dashed animate-[spin_60s_linear_infinite]"></div>
          </div>
          
          <div className="relative z-10 p-8 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                <Navigation className="w-6 h-6 mr-3 text-primary animate-pulse" /> 
                Live Network Radar
              </h2>
              <p className="text-primary/80 text-sm mt-2 font-mono uppercase tracking-widest">{stats.activeLoads} Active Loads in Transit</p>
            </div>
            <div className="flex space-x-3">
               <div className="glass-button w-10 h-10 flex items-center justify-center rounded-full bg-white/5">
                 <Activity className="w-5 h-5 text-gray-300" />
               </div>
            </div>
          </div>

          <div className="relative z-10 mt-auto p-8">
            <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Active Assignments</h3>
            <div className="flex space-x-4 overflow-x-auto pb-4 hide-scrollbar">
              {loading ? (
                <div className="text-gray-500 font-mono text-sm">Syncing satellite data...</div>
              ) : activeDrivers.map((d, i) => (
                <div key={d.id} className="min-w-[280px] bg-black/60 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-primary/50 transition-colors duration-300 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center mr-3 font-bold text-xs border border-white/10">
                          {d.first_name.charAt(0)}{d.last_name.charAt(0)}
                       </div>
                       <span className="font-bold text-white">{d.first_name} {d.last_name}</span>
                    </div>
                    {d.currentLoad ? (
                       <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-md font-mono font-bold uppercase tracking-wider flex items-center shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                         <div className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5 animate-ping"></div>
                         In Transit
                       </span>
                    ) : (
                       <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-1 rounded-md font-mono font-bold uppercase tracking-wider">
                         Idle
                       </span>
                    )}
                  </div>
                  
                  {d.currentLoad ? (
                     <>
                        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                           <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {d.currentLoad.pickup_location?.split(',')[0]}</span>
                           <span className="text-gray-600">→</span>
                           <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {d.currentLoad.delivery_location?.split(',')[0]}</span>
                        </div>
                         <div className="text-xs font-mono text-primary/70 mb-3 flex items-center justify-between">
                            <span>Load #{d.currentLoad.load_number}</span>
                            {d.currentVehicle?.current_location_lat && (
                               <span className="text-[10px] text-blue-400 flex items-center bg-blue-500/10 px-1.5 py-0.5 rounded">
                                  <Navigation className="w-3 h-3 mr-1" /> {d.currentVehicle.current_location_lat.toFixed(4)}, {d.currentVehicle.current_location_lng.toFixed(4)}
                               </span>
                            )}
                         </div>
                        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden relative">
                           <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-primary to-blue-400 rounded-full w-[60%]"></div>
                        </div>
                     </>
                  ) : (
                     <div className="text-sm text-gray-500 italic mt-4">Awaiting dispatch</div>
                  )}
                </div>
              ))}
              {activeDrivers.length === 0 && !loading && (
                 <div className="text-gray-500 font-mono text-sm">No drivers currently in system.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: KPIs and Alerts */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2 hide-scrollbar">
          
          {/* Financial KPI */}
          <div className="glass-panel p-6 bg-gradient-to-br from-[#0B1021] to-[#121A33] border border-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-2 relative z-10">
              <h3 className="text-primary/80 font-bold text-xs uppercase tracking-widest">Total Gross Revenue</h3>
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-5xl font-black tracking-tighter text-white relative z-10 my-4">
               <span className="text-gray-500 font-normal">$</span>
               {stats.revenue.toLocaleString()}
               <span className="text-xl text-gray-500 font-normal">.00</span>
            </div>
            <div className="mt-4 flex items-center text-sm relative z-10">
              <span className="text-success font-bold flex items-center bg-success/10 px-2 py-1 rounded text-xs"><TrendingUp className="w-3 h-3 mr-1" /> ALL TIME</span>
              <span className="text-gray-500 ml-3 text-xs font-mono">From {stats.deliveredLoads} delivered loads</span>
            </div>
          </div>

          {/* Fleet Status */}
          <div className="glass-panel p-6 border border-white/5 flex-1">
            <h3 className="text-gray-400 font-bold text-xs mb-6 uppercase tracking-widest">Platform Metrics</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-4">
                     <Truck className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="font-bold text-gray-200">Registered Drivers</span>
                </div>
                <span className="font-mono text-xl font-bold text-white">{stats.totalDrivers}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mr-4">
                     <Package className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-bold text-gray-200">Loads in Transit</span>
                </div>
                <span className="font-mono text-xl font-bold text-white">{stats.activeLoads}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mr-4">
                     <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-bold text-gray-200">Loads Completed</span>
                </div>
                <span className="font-mono text-xl font-bold text-white">{stats.deliveredLoads}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center mr-4">
                     <Wrench className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="font-bold text-gray-200">Maintenance Issues</span>
                </div>
                <span className="font-mono text-xl font-bold text-white">{stats.maintenanceAlerts}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
