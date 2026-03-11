import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';

type Params = { params: Promise<{ id: string }> };

function normalizeUid(value: string): string {
  return value.trim().toUpperCase();
}

/** POST: asignar tarjeta NFC a un trabajador (uid en body) */
export async function POST(request: Request, { params }: Params) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  const { id: workerId } = await params;
  if (!workerId) {
    return NextResponse.json({ error: 'id de trabajador es obligatorio' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { uid?: string };
    const uid = body.uid ? normalizeUid(body.uid) : '';
    if (!uid) {
      return NextResponse.json({ error: 'uid de tarjeta es obligatorio' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: existing, error: findError } = await supabase
      .from('tarjetas')
      .select('id, trabajador_id')
      .eq('uid_fisico', uid)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (existing?.trabajador_id && existing.trabajador_id !== workerId) {
      return NextResponse.json(
        { error: 'Ese UID ya está asignado a otro empleado' },
        { status: 400 },
      );
    }

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from('tarjetas')
        .update({ trabajador_id: workerId, activa: true })
        .eq('id', existing.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      // Obtener el numero_logico del trabajador para asignarlo también a la tarjeta
      const { data: workerRow, error: workerErr } = await supabase
        .from('trabajadores')
        .select('numero_logico')
        .eq('id', workerId)
        .maybeSingle();

      if (workerErr) {
        return NextResponse.json({ error: workerErr.message }, { status: 500 });
      }
      if (!workerRow) {
        return NextResponse.json({ error: 'Trabajador no encontrado para asignar tarjeta' }, { status: 404 });
      }

      const { error: insertErr } = await supabase
        .from('tarjetas')
        .insert({
          uid_fisico: uid,
          trabajador_id: workerId,
          numero_logico: workerRow.numero_logico,
          activa: true,
        });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al asignar tarjeta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
