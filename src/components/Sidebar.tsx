"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Truck, Users, Activity, Settings, Wrench, DollarSign, ShieldCheck, Building, Droplet } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-24 h-full flex flex-col items-center py-8 glass-panel mr-6">
      <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-12 shadow-lg shadow-blue-500/30">
        <Truck className="text-white w-6 h-6" />
      </div>
      
      <div className="flex flex-col space-y-8 flex-1">
        <NavItem href="/" icon={<Home className="w-6 h-6" />} active={pathname === '/'} />
        <NavItem href="/fleet" icon={<Truck className="w-6 h-6" />} active={pathname === '/fleet'} />
        <NavItem href="/drivers" icon={<Users className="w-6 h-6" />} active={pathname === '/drivers'} />
        <NavItem href="/logs" icon={<ShieldCheck className="w-6 h-6" />} active={pathname === '/logs'} />
        <NavItem href="/loads" icon={<Activity className="w-6 h-6" />} active={pathname === '/loads'} />
        <NavItem href="/maintenance" icon={<Wrench className="w-6 h-6" />} active={pathname === '/maintenance'} />
        <NavItem href="/fuel-logs" icon={<Droplet className="w-6 h-6" />} active={pathname === '/fuel-logs'} />
        <NavItem href="/financials" icon={<DollarSign className="w-6 h-6" />} active={pathname === '/financials'} />
        <NavItem href="/admin" icon={<Building className="w-6 h-6" />} active={pathname === '/admin'} />
      </div>

      <div className="mt-auto">
        <NavItem href="/settings" icon={<Settings className="w-6 h-6" />} active={pathname === '/settings'} />
      </div>
    </nav>
  );
}

function NavItem({ href, icon, active = false }: { href: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link href={href}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-[rgba(255,255,255,0.15)] text-white shadow-inner' : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
        {icon}
      </div>
    </Link>
  );
}
