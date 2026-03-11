import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';

/** POST: crear trabajador y opcionalmente asignar tarjeta NFC */
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  try {
    const body = (await request.json()) as {
      nombre_completo: string;
      departamento?: string | null;
      uid_tarjeta?: string | null;
    };

    const nombre = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
    if (!nombre) {
      return NextResponse.json({ error: 'nombre_completo es obligatorio' }, { status: 400 });
    }

    const departamento =
      typeof body.departamento === 'string' && body.departamento.trim()
        ? body.departamento.trim()
        : null;
    const uidTarjeta =
      typeof body.uid_tarjeta === 'string' && body.uid_tarjeta.trim()
        ? body.uid_tarjeta.trim().toUpperCase()
        : null;

    const supabase = createSupabaseServerClient();

    // Calcular el siguiente numero_logico disponible de forma centralizada
    const { data: maxRow, error: maxErr } = await supabase
      .from('trabajadores')
      .select('numero_logico')
      .order('numero_logico', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) {
      return NextResponse.json({ error: maxErr.message }, { status: 500 });
    }

    const numero_logico = (maxRow?.numero_logico ?? 0) + 1;

    const payload: Record<string, unknown> = {
      nombre_completo: nombre,
      numero_logico,
      activo: true,
    };
    if (departamento !== null) payload.departamento = departamento;

    const { data, error } = await supabase
      .from('trabajadores')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('api key')) {
        return NextResponse.json(
          {
            error:
              'Clave de Supabase incorrecta. En el panel de Supabase (Project Settings → API) copia la clave "service_role" (secret) y ponla en .env.local como SUPABASE_SERVICE_ROLE_KEY. Luego reinicia el servidor.',
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workerId = (data as { id: string } | null)?.id;
    if (!workerId) {
      return NextResponse.json({ error: 'No se pudo obtener el empleado creado' }, { status: 500 });
    }

    if (uidTarjeta) {
      const { data: existing } = await supabase
        .from('tarjetas')
        .select('id, trabajador_id')
        .eq('uid_fisico', uidTarjeta)
        .maybeSingle();

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
        const { error: insertErr } = await supabase
          .from('tarjetas')
          .insert({
            uid_fisico: uidTarjeta,
            trabajador_id: workerId,
            // La tarjeta comparte el mismo número lógico que el trabajador
            numero_logico,
            activa: true,
          });
        if (insertErr) {
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ id: workerId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al crear empleado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
