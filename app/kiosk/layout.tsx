import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Fichaje · Terminal',
  description: 'Terminal de fichaje para tablet',
};

export default function KioskLayout({ children }: { children: ReactNode }) {
  return children;
}
