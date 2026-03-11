import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getRequiredEnv(
  name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY',
): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${name}. Añádela en .env.local y reinicia el servidor.`);
  }
  return value;
}

export function createSupabaseServerClient(): SupabaseClient {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

