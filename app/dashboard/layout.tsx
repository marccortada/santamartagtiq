import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: 20 }}>
        <h1>Panel Owner · Santa Marta</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard/fichajes">Fichajes</Link>
          <Link href="/dashboard/gift-cards">Gift Cards</Link>
          <Link href="/dashboard/gift-cards/lookup">Lookup UID</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

