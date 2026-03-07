import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';
import { buildWorkerReport, type PeriodMode } from '@/lib/server/reports';

function parseMode(value: unknown): PeriodMode {
  return value === 'month' ? 'month' : 'week';
}

function parseAnchor(value: unknown): Date {
  if (typeof value !== 'string' || value.length === 0) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  try {
    const body = (await request.json()) as {
      mode?: PeriodMode;
      anchor?: string;
      workerId?: string;
      department?: string;
    };

    const supabase = createSupabaseServerClient();
    const report = await buildWorkerReport({
      supabase,
      mode: parseMode(body.mode),
      anchor: parseAnchor(body.anchor),
      workerId: body.workerId || undefined,
      department: body.department || undefined,
    });

    const pdf = await PDFDocument.create();
    let page = pdf.addPage([842, 595]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 560;
    const left = 40;
    const lineHeight = 18;

    const draw = (text: string, options?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
      page.drawText(text, {
        x: left,
        y,
        size: options?.size ?? 11,
        font: options?.bold ? bold : font,
        color: options?.color ? rgb(options.color[0], options.color[1], options.color[2]) : rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    };

    const ensureSpace = (rowsNeeded = 1) => {
      if (y > 40 + rowsNeeded * lineHeight) return;
      page = pdf.addPage([842, 595]);
      y = 560;
    };

    draw('Santa Marta - Informe de trabajadores', { bold: true, size: 18, color: [0.05, 0.2, 0.85] });
    draw(`Periodo: ${report.rangeLabel}`, { size: 12 });
    draw(`Filtro trabajador: ${report.selectedWorkerLabel}`, { size: 12 });
    draw(`Filtro departamento: ${body.department || 'Todos'}`, { size: 12 });
    y -= 8;

    draw(
      `Resumen -> Trabajadores: ${report.rows.length} | Fichajes: ${report.summary.totalFichajes} | Entradas: ${report.summary.totalEntradas} | Salidas: ${report.summary.totalSalidas}`,
      { bold: true },
    );

    y -= 8;
    draw('Top trabajadores', { bold: true, size: 14 });
    draw('Nombre                                Total   Entradas   Salidas', { bold: true });

    const topRows = report.rows.filter((row) => row.total > 0).slice(0, 40);
    for (const row of topRows) {
      ensureSpace();
      const name = row.nombre.length > 34 ? `${row.nombre.slice(0, 31)}...` : row.nombre;
      const line = `${name.padEnd(36, ' ')} ${String(row.total).padStart(5, ' ')} ${String(row.entradas).padStart(9, ' ')} ${String(row.salidas).padStart(9, ' ')}`;
      draw(line);
    }

    if (topRows.length === 0) {
      draw('Sin datos para el periodo seleccionado.');
    }

    y -= 8;
    ensureSpace(4);
    draw('Ausencias', { bold: true, size: 14 });

    const absences = report.rows.filter((row) => row.total === 0).slice(0, 50);
    for (const row of absences) {
      ensureSpace();
      draw(`- ${row.nombre}`);
    }

    if (absences.length === 0) {
      draw('Sin ausencias en el periodo.');
    }

    const bytes = await pdf.save();
    const pdfBody = Uint8Array.from(bytes);
    const filename = `informe-trabajadores-${report.from}-${report.to}.pdf`;

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al exportar PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
