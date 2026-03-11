import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';
import { buildDayTimeline } from '@/lib/server/reports';

function parseDateParam(value: string | null): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isValid) {
    return new Date().toISOString().slice(0, 10);
  }

  return value;
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  const url = new URL(request.url);
  const date = parseDateParam(url.searchParams.get('date'));
  const workerId = url.searchParams.get('workerId') ?? undefined;
  const department = url.searchParams.get('department') ?? undefined;

  try {
    const supabase = createSupabaseServerClient();
    const events = await buildDayTimeline({
      supabase,
      date,
      workerId,
      department,
    });

    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cargar timeline';
    console.error('[api/owner/timeline]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
