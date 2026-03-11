import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';

type Params = { params: Promise<{ id: string }> };

/** PATCH: actualizar tarjeta (uid_fisico y/o activa) */
export async function PATCH(request: Request, { params }: Params) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { uid_fisico?: string; activa?: boolean };

    const payload: Record<string, unknown> = {};
    if (typeof body.uid_fisico === 'string') payload.uid_fisico = body.uid_fisico.trim().toUpperCase();
    if (typeof body.activa === 'boolean') payload.activa = body.activa;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('tarjetas').update(payload).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al actualizar tarjeta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
