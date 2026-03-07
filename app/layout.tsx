import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import { AppShell } from './_components/app-shell';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning className={manrope.variable}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
