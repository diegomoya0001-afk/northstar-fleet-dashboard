"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Truck, Users, Activity, Settings, Wrench, DollarSign, ShieldCheck, Building, Droplet, Wallet, Briefcase, FileBarChart } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [accessList, setAccessList] = useState<string[]>(['all']);

  useEffect(() => {
    const accessStr = localStorage.getItem('fleet_module_access') || '["all"]';
    try {
      setAccessList(JSON.parse(accessStr));
    } catch (e) {
      setAccessList(['all']);
    }
  }, []);

  const hasAccess = (module: string) => {
    return accessList.includes('all') || accessList.includes(module);
  };

  return (
    <nav className="w-24 h-full flex flex-col items-center py-6 glass-panel mr-6 print:hidden">
      <div className="w-12 h-12 bg-primary flex-shrink-0 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
        <Truck className="text-white w-6 h-6" />
      </div>
      
      {/* Scrollable Middle Section */}
      <div className="flex flex-col space-y-2 flex-1 w-full items-center overflow-y-auto hide-scrollbar pb-4">
        <NavItem href="/" icon={<Home className="w-6 h-6" />} active={pathname === '/'} />
        {hasAccess('fleet') && <NavItem href="/fleet" icon={<Truck className="w-6 h-6" />} active={pathname === '/fleet'} />}
        {hasAccess('drivers') && <NavItem href="/drivers" icon={<Users className="w-6 h-6" />} active={pathname === '/drivers'} />}
        {hasAccess('logs') && <NavItem href="/logs" icon={<ShieldCheck className="w-6 h-6" />} active={pathname === '/logs'} />}
        {hasAccess('loads') && <NavItem href="/loads" icon={<Activity className="w-6 h-6" />} active={pathname === '/loads'} />}
        {hasAccess('brokers') && <NavItem href="/brokers" icon={<Briefcase className="w-6 h-6" />} active={pathname === '/brokers'} />}
        {hasAccess('maintenance') && <NavItem href="/maintenance" icon={<Wrench className="w-6 h-6" />} active={pathname === '/maintenance'} />}
        {hasAccess('fuel-logs') && <NavItem href="/fuel-logs" icon={<Droplet className="w-6 h-6" />} active={pathname === '/fuel-logs'} />}
        
        {hasAccess('all') && <NavItem href="/admin" icon={<Building className="w-6 h-6" />} active={pathname === '/admin'} />}
        
        {hasAccess('financials') && <NavItem href="/financials" icon={<DollarSign className="w-6 h-6" />} active={pathname === '/financials'} />}
        {hasAccess('ifta') && <NavItem href="/ifta" icon={<FileBarChart className="w-6 h-6" />} active={pathname === '/ifta'} />}
        {hasAccess('payroll') && <NavItem href="/payroll" icon={<Wallet className="w-6 h-6" />} active={pathname === '/payroll'} />}

        {hasAccess('settings') && (
          <div className="mt-2 pb-2 w-12 mx-auto shrink-0">
            <NavItem href="/settings" icon={<Settings className="w-6 h-6" />} active={pathname === '/settings'} />
          </div>
        )}
      </div>

      {/* Fixed Bottom Section */}
      <div className="pt-4 w-full flex flex-col items-center shrink-0 border-t border-white/5">
         <button 
           onClick={() => {
             localStorage.removeItem('fleet_user_id');
             localStorage.removeItem('fleet_user_role');
             localStorage.removeItem('fleet_user_name');
             window.location.href = '/login';
           }}
           className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
           title="Sign Out"
         >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
         </button>
      </div>
    </nav>
  );
}

function NavItem({ href, icon, active = false }: { href: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link href={href}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-[rgba(255,255,255,0.15)] text-white shadow-inner' : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
        {icon}
      </div>
    </Link>
  );
}
