"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Determine the user's role and access
    const role = localStorage.getItem('fleet_user_role') || 'dispatcher';
    const accessStr = localStorage.getItem('fleet_module_access') || '["all"]';
    
    let accessList: string[] = ['all'];
    try {
      accessList = JSON.parse(accessStr);
    } catch (e) {
      console.error('Error parsing module access', e);
    }

    // Always allow Home (Command Center) and Settings for basic profile access, unless explicitly blocked
    // However, if they don't have access to the specific route, redirect to home.
    let isAllowed = true;
    
    if (accessList.includes('all')) {
       isAllowed = true;
    } else {
       // Define which module controls which route prefix
       const routeToModuleMap: Record<string, string> = {
          '/fleet': 'fleet',
          '/drivers': 'drivers',
          '/logs': 'logs',
          '/loads': 'loads',
          '/brokers': 'brokers',
          '/maintenance': 'maintenance',
          '/fuel-logs': 'fuel-logs',
          '/financials': 'financials',
          '/ifta': 'ifta',
          '/payroll': 'payroll',
          '/settings': 'settings' // Admin settings
       };

       const currentPrefix = Object.keys(routeToModuleMap).find(prefix => pathname.startsWith(prefix));
       
       if (currentPrefix) {
          const requiredModule = routeToModuleMap[currentPrefix];
          if (!accessList.includes(requiredModule)) {
             isAllowed = false;
          }
       }
    }

    if (!isAllowed && pathname !== '/') {
      router.replace('/');
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
}
