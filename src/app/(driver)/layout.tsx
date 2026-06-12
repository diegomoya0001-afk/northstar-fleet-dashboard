"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, FileText, User, FolderOpen, Droplet } from "lucide-react";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="h-screen w-full bg-[#000] flex justify-center overflow-hidden">
      {/* Mobile constraint container for desktop view */}
      <div className="w-full max-w-md h-full bg-[#0a0a0a] shadow-2xl relative flex flex-col sm:border-x sm:border-white/10">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {children}
        </div>

        {/* Bottom Navigation Bar */}
        <nav className="bg-[#111] border-t border-white/5 pb-safe pt-2 px-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50">
           <Link href="/driver-app" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/driver-app' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl mb-1 ${pathname === '/driver-app' ? 'bg-primary/20' : 'bg-transparent'}`}>
                 <Home className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold">Home</span>
           </Link>
           
           <Link href="/hos-logs" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/hos-logs' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl mb-1 ${pathname === '/hos-logs' ? 'bg-primary/20' : 'bg-transparent'}`}>
                 <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold">Logs</span>
           </Link>

           <Link href="/fuel" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/fuel' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl mb-1 ${pathname === '/fuel' ? 'bg-primary/20' : 'bg-transparent'}`}>
                 <Droplet className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold">Fuel</span>
           </Link>

           <Link href="/documents" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/documents' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl mb-1 ${pathname === '/documents' ? 'bg-primary/20' : 'bg-transparent'}`}>
                 <FolderOpen className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold">Glovebox</span>
           </Link>

           <Link href="/pre-trip" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/pre-trip' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl mb-1 ${pathname === '/pre-trip' ? 'bg-primary/20' : 'bg-transparent'}`}>
                 <FileText className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold">Pre-Trip</span>
           </Link>
        </nav>
      </div>
    </div>
  );
}
