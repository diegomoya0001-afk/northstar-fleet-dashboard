import React from 'react';
import { Truck, MapPin, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header section */}
      <header className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-gray-400 mt-1">Tuesday, 9 Jun 2026</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="glass-panel px-4 py-2 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">All Systems Operational</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg">
            JD
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* Map Widget (Left Column) */}
        <div className="col-span-12 lg:col-span-8 glass-panel flex flex-col relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center opacity-40 transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          
          <div className="relative z-10 p-6 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold flex items-center"><MapPin className="w-5 h-5 mr-2 text-primary" /> Active Fleet Tracker</h2>
              <p className="text-gray-300 text-sm mt-1">12 trucks currently on route</p>
            </div>
            <button className="glass-button w-10 h-10">
              <TrendingUp className="w-5 h-5" />
            </button>
          </div>

          <div className="relative z-10 mt-auto p-6">
            <div className="flex space-x-4 overflow-x-auto pb-4 hide-scrollbar">
              {/* Active Truck Card */}
              <div className="min-w-[240px] bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold">Truck #402</span>
                  <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-md">Moving</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Speed</span>
                  <span className="font-semibold text-white">65 mph</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300 mt-1">
                  <span>Driver</span>
                  <span className="font-semibold text-white">Mike Johnson</span>
                </div>
                <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>

              {/* Idle Truck Card */}
              <div className="min-w-[240px] bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold">Truck #218</span>
                  <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded-md">Idle (12m)</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Location</span>
                  <span className="font-semibold text-white">Dallas, TX</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300 mt-1">
                  <span>Driver</span>
                  <span className="font-semibold text-white">Sarah Smith</span>
                </div>
                <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-warning h-1.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: KPIs and Alerts */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2 hide-scrollbar">
          
          {/* Financial KPI */}
          <div className="glass-panel p-6 bg-gradient-to-br from-[rgba(30,30,30,0.7)] to-[rgba(10,132,255,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-medium text-sm">Revenue Today</h3>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-4xl font-bold tracking-tight">$8,240<span className="text-lg text-gray-500 font-normal">.50</span></div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-success font-semibold flex items-center"><TrendingUp className="w-4 h-4 mr-1" /> +12%</span>
              <span className="text-gray-400 ml-2">vs yesterday</span>
            </div>
          </div>

          {/* Fleet Status */}
          <div className="glass-panel p-6">
            <h3 className="text-gray-400 font-medium text-sm mb-4">Fleet Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-success mr-3" />
                  <span>On the Road</span>
                </div>
                <span className="font-bold">12</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-warning mr-3" />
                  <span>Loading/Unloading</span>
                </div>
                <span className="font-bold">3</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-danger mr-3" />
                  <span>Maintenance</span>
                </div>
                <span className="font-bold">1</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="glass-panel p-6 flex-1 flex flex-col border border-danger/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-danger font-semibold flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Action Required
              </h3>
              <span className="bg-danger/20 text-danger text-xs px-2 py-1 rounded-full font-bold">2</span>
            </div>
            
            <div className="space-y-3 overflow-y-auto flex-1">
              <div className="bg-danger/10 border border-danger/20 p-3 rounded-xl">
                <div className="font-semibold text-sm mb-1">HOS Violation Risk</div>
                <div className="text-xs text-gray-300">Driver John D. has 45 mins remaining on 11-hour limit. Currently 60 miles from destination.</div>
              </div>
              
              <div className="bg-warning/10 border border-warning/20 p-3 rounded-xl">
                <div className="font-semibold text-sm mb-1 text-warning">Pre-Trip Defect</div>
                <div className="text-xs text-gray-300">Truck #105 reported worn tire tread. Maintenance ticket automatically generated.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
