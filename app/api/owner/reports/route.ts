import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';
import { buildWorkerReport, type PeriodMode } from '@/lib/server/reports';

function parseMode(value: string | null): PeriodMode {
  return value === 'month' ? 'month' : 'week';
}

function parseAnchor(value: string | null): Date {
  const fallback = new Date();
  if (!value) return fallback;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get('mode'));
  const anchor = parseAnchor(url.searchParams.get('anchor'));
  const workerId = url.searchParams.get('workerId') ?? undefined;
  const department = url.searchParams.get('department') ?? undefined;

  try {
    const supabase = createSupabaseServerClient();
    const payload = await buildWorkerReport({
      supabase,
      mode,
      anchor,
      workerId,
      department,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar el informe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
