'use client';

import { supabase } from '@/lib/supabaseClient';

async function getAccessTokenOrNull(): Promise<string | null> {
  const {
    data: { session },
    error: _error,
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function ownerApiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const token = await getAccessTokenOrNull();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function ownerApiDownload(input: string, init?: RequestInit): Promise<Blob> {
  const token = await getAccessTokenOrNull();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return await response.blob();
}
