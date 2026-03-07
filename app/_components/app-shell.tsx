'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

type NavItem = {
  href?: string;
  label: string;
  icon: string;
  isActive: (pathname: string) => boolean;
  action?: 'logout';
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'D', isActive: (pathname) => pathname === '/dashboard' },
  {
    href: '/dashboard/informes',
    label: 'Informes',
    icon: 'I',
    isActive: (pathname) => pathname.startsWith('/dashboard/informes'),
  },
  { href: '/fichar', label: 'Fichar', icon: 'F', isActive: (pathname) => pathname.startsWith('/fichar') },
  {
    href: '/dashboard/fichajes',
    label: 'Fichajes',
    icon: 'R',
    isActive: (pathname) => pathname.startsWith('/dashboard/fichajes'),
  },
  {
    href: '/dashboard/empleados',
    label: 'Empleados',
    icon: 'E',
    isActive: (pathname) => pathname.startsWith('/dashboard/empleados'),
  },
  {
    href: '/dashboard/gift-cards',
    label: 'Tarjetas regalo',
    icon: 'T',
    isActive: (pathname) => pathname.startsWith('/dashboard/gift-cards') && pathname !== '/dashboard/gift-cards/lookup',
  },
  {
    href: '/dashboard/gift-cards/lookup',
    label: 'Ajustes',
    icon: 'A',
    isActive: (pathname) => pathname === '/dashboard/gift-cards/lookup',
  },
  { label: 'Logout', icon: 'L', isActive: () => false, action: 'logout' },
];

function SidebarLink({ item, active, onLogout }: { item: NavItem; active: boolean; onLogout: () => void }) {
  if (item.action === 'logout') {
    return (
      <button type="button" className={`sidebar-link ${active ? 'active' : ''}`} onClick={onLogout}>
        <span className="sidebar-icon">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <Link href={item.href ?? '/'} className={`sidebar-link ${active ? 'active' : ''}`}>
      <span className="sidebar-icon">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/code-logout', { method: 'POST' });
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/unauthorized')) {
    return <>{children}</>;
  }

  return (
    <div className="app-bg">
      <div className="app-shell">
        <aside className="app-sidebar">
          <div>
            <Image src="/logo-santa-marta-light.svg" alt="Santa Marta" width={190} height={44} className="app-logo-image" priority />
            <p className="app-subtitle">Panel principal</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <SidebarLink key={item.label} item={item} active={item.isActive(pathname)} onLogout={handleLogout} />
            ))}
          </nav>

          <div className="app-device-card">
            Terminal activo
            <br />
            <strong>lector-caja-1</strong>
          </div>
        </aside>

        <div className="app-main">
          <header className="app-mobile-header">
            <Image src="/logo-santa-marta-dark.svg" alt="Santa Marta" width={132} height={32} className="app-mobile-logo-image" priority />
            <Link href="/dashboard" className="app-mobile-btn">
              Dashboard
            </Link>
          </header>
          <div className="app-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
