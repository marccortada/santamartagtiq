import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

/**
 * GET /api/health — Comprueba que las variables de Supabase estén cargadas
 * y que la clave service_role sea aceptada por Supabase.
 * No requiere owner. Útil para depurar 500 en /api/settings y /api/owner/timeline.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const keyType = key.startsWith('eyJ') ? 'jwt' : key.startsWith('sb_secret_') ? 'secret' : 'unknown';

  if (!hasUrl || !hasServiceKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Faltan variables de entorno',
        env: {
          NEXT_PUBLIC_SUPABASE_URL: hasUrl ? 'ok' : 'falta',
          SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? 'ok' : 'falta',
        },
        debug: { keyLength: key.length, keyType },
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from('app_config').select('id').limit(1).maybeSingle();

    if (error) {
      console.error('[api/health] Supabase error:', error.message);
      return NextResponse.json(
        {
          ok: false,
          error: 'Supabase rechazó la petición',
          detail: error.message,
          debug: { keyLength: key.length, keyType },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, env: 'ok', supabase: 'ok', debug: { keyType } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[api/health] Exception:', message);
    return NextResponse.json(
      { ok: false, error: 'Excepción al conectar con Supabase', detail: message },
      { status: 503 },
    );
  }
}
