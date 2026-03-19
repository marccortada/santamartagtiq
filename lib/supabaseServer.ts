import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${name}. Añádela en .env o .env.local y reinicia el servidor.`);
  }
  return value;
}

/**
 * Clave para el cliente servidor (API routes).
 *
 * Orden (importante):
 * 1. SUPABASE_SERVER_KEY — si quieres fijar tú una sola clave (anon o service_role).
 * 2. NEXT_PUBLIC_SUPABASE_ANON_KEY — primero: suele ser la que menos falla si la
 *    service_role está mal copiada o es de otro proyecto (causa típica de "Invalid API key").
 * 3. SUPABASE_SERVICE_ROLE_KEY — bypass RLS; úsala cuando la anon esté bien y quieras permisos elevados.
 *
 * Si la service_role en .env está mal pero no vacía, poner anon primero evita que "gane" la clave mala.
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');

  const key =
    process.env.SUPABASE_SERVER_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error(
      'Falta al menos una clave: NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVER_KEY).',
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

