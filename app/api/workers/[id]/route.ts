import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';

type Params = { params: Promise<{ id: string }> };

/** PATCH: actualizar perfil del trabajador (nombre, departamento, activo) */
export async function PATCH(request: Request, { params }: Params) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      nombre_completo?: string;
      departamento?: string | null;
      activo?: boolean;
    };

    const payload: Record<string, unknown> = {};
    if (typeof body.nombre_completo === 'string') payload.nombre_completo = body.nombre_completo.trim();
    if (body.departamento !== undefined) payload.departamento = body.departamento?.trim() || null;
    if (typeof body.activo === 'boolean') payload.activo = body.activo;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('trabajadores').update(payload).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al actualizar empleado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
