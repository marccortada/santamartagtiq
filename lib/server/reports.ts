import type { SupabaseClient } from '@supabase/supabase-js';

export type PeriodMode = 'week' | 'month';

export type Worker = {
  id: string;
  nombre_completo: string;
  departamento: string | null;
  activo: boolean;
};

type FichajeRow = {
  id: string;
  trabajador_id: string;
  tipo: 'in' | 'out' | null;
  fichado_en: string;
  fecha_laboral: string;
  dispositivo_id: string | null;
};

export type WorkerReportRow = {
  trabajadorId: string;
  nombre: string;
  total: number;
  entradas: number;
  salidas: number;
  lastFichado: string | null;
};

export type DayEvent = {
  id: string;
  nombre: string;
  hora: string;
  tipo: 'in' | 'out' | null;
  dispositivo: string | null;
};

export type ReportSummary = {
  totalFichajes: number;
  totalEntradas: number;
  totalSalidas: number;
  activos: number;
  ausentes: number;
};

export type ReportPayload = {
  rangeLabel: string;
  from: string;
  to: string;
  workers: Pick<Worker, 'id' | 'nombre_completo'>[];
  departments: string[];
  rows: WorkerReportRow[];
  events: DayEvent[];
  summary: ReportSummary;
  selectedWorkerLabel: string;
};

function toInputDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function buildRange(anchor: Date, mode: PeriodMode): { from: string; to: string; label: string } {
  if (mode === 'week') {
    const fromDate = startOfWeek(anchor);
    const toDate = endOfWeek(anchor);
    const from = toInputDate(fromDate);
    const to = toInputDate(toDate);

    return {
      from,
      to,
      label: `Semana del ${fromDate.toLocaleDateString('es-ES')} al ${toDate.toLocaleDateString('es-ES')}`,
    };
  }

  const fromDate = startOfMonth(anchor);
  const toDate = endOfMonth(anchor);
  const from = toInputDate(fromDate);
  const to = toInputDate(toDate);

  return {
    from,
    to,
    label: anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  };
}

async function fetchWorkersWithFallback(supabase: SupabaseClient): Promise<Worker[]> {
  const withDepartment = await supabase
    .from('trabajadores')
    .select('id, nombre_completo, departamento, activo')
    .order('nombre_completo', { ascending: true });

  if (!withDepartment.error) {
    return (withDepartment.data ?? []) as Worker[];
  }

  const withoutDepartment = await supabase
    .from('trabajadores')
    .select('id, nombre_completo, activo')
    .order('nombre_completo', { ascending: true });

  if (withoutDepartment.error) {
    throw new Error(withoutDepartment.error.message);
  }

  return ((withoutDepartment.data ?? []) as Omit<Worker, 'departamento'>[]).map((worker) => ({
    ...worker,
    departamento: null,
  }));
}

export async function buildWorkerReport(options: {
  supabase: SupabaseClient;
  mode: PeriodMode;
  anchor: Date;
  workerId?: string;
  department?: string;
}): Promise<ReportPayload> {
  const { supabase, mode, anchor, workerId, department } = options;
  const range = buildRange(anchor, mode);

  const allWorkers = (await fetchWorkersWithFallback(supabase)).filter((worker) => worker.activo);

  const departments = Array.from(
    new Set(allWorkers.map((worker) => worker.departamento?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const workersByDepartment = department
    ? allWorkers.filter((worker) => (worker.departamento ?? '').toLowerCase() === department.toLowerCase())
    : allWorkers;

  const scopedWorkers = workerId
    ? workersByDepartment.filter((worker) => worker.id === workerId)
    : workersByDepartment;

  const workersFilterList = workersByDepartment.map((worker) => ({ id: worker.id, nombre_completo: worker.nombre_completo }));

  if (scopedWorkers.length === 0) {
    return {
      rangeLabel: range.label,
      from: range.from,
      to: range.to,
      workers: workersFilterList,
      departments,
      rows: [],
      events: [],
      summary: {
        totalFichajes: 0,
        totalEntradas: 0,
        totalSalidas: 0,
        activos: 0,
        ausentes: 0,
      },
      selectedWorkerLabel: workerId ? 'Trabajador seleccionado' : 'Todos los trabajadores',
    };
  }

  const workerIds = scopedWorkers.map((worker) => worker.id);

  const { data: fichajesData, error: fichajesError } = await supabase
    .from('fichajes')
    .select('id, trabajador_id, tipo, fichado_en, fecha_laboral, dispositivo_id')
    .gte('fecha_laboral', range.from)
    .lte('fecha_laboral', range.to)
    .in('trabajador_id', workerIds)
    .order('fichado_en', { ascending: false });

  if (fichajesError) {
    throw new Error(fichajesError.message);
  }

  const workersMap = new Map(scopedWorkers.map((worker) => [worker.id, worker]));
  const reportMap = new Map<string, WorkerReportRow>();

  for (const worker of scopedWorkers) {
    reportMap.set(worker.id, {
      trabajadorId: worker.id,
      nombre: worker.nombre_completo,
      total: 0,
      entradas: 0,
      salidas: 0,
      lastFichado: null,
    });
  }

  const fichajesList = (fichajesData ?? []) as FichajeRow[];

  for (const fichaje of fichajesList) {
    const fallbackName = workersMap.get(fichaje.trabajador_id)?.nombre_completo ?? fichaje.trabajador_id;
    const rowName = fallbackName;

    const current =
      reportMap.get(fichaje.trabajador_id) ??
      ({
        trabajadorId: fichaje.trabajador_id,
        nombre: rowName,
        total: 0,
        entradas: 0,
        salidas: 0,
        lastFichado: null,
      } as WorkerReportRow);

    current.total += 1;
    if (fichaje.tipo === 'in') current.entradas += 1;
    if (fichaje.tipo === 'out') current.salidas += 1;

    if (!current.lastFichado || new Date(fichaje.fichado_en).getTime() > new Date(current.lastFichado).getTime()) {
      current.lastFichado = fichaje.fichado_en;
    }

    reportMap.set(fichaje.trabajador_id, current);
  }

  const rows = Array.from(reportMap.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const events = fichajesList.slice(0, 8).map((fichaje) => {
    return {
      id: fichaje.id,
      nombre: workersMap.get(fichaje.trabajador_id)?.nombre_completo ?? fichaje.trabajador_id,
      hora: new Date(fichaje.fichado_en).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      tipo: fichaje.tipo,
      dispositivo: fichaje.dispositivo_id,
    } as DayEvent;
  });

  const summary: ReportSummary = {
    totalFichajes: rows.reduce((acc, row) => acc + row.total, 0),
    totalEntradas: rows.reduce((acc, row) => acc + row.entradas, 0),
    totalSalidas: rows.reduce((acc, row) => acc + row.salidas, 0),
    activos: rows.filter((row) => row.total > 0).length,
    ausentes: rows.filter((row) => row.total === 0).length,
  };

  const selectedWorkerLabel = workerId
    ? scopedWorkers.find((worker) => worker.id === workerId)?.nombre_completo ?? 'Trabajador seleccionado'
    : 'Todos los trabajadores';

  return {
    rangeLabel: range.label,
    from: range.from,
    to: range.to,
    workers: workersFilterList,
    departments,
    rows,
    events,
    summary,
    selectedWorkerLabel,
  };
}

export async function buildDayTimeline(options: {
  supabase: SupabaseClient;
  date: string;
  workerId?: string;
  department?: string;
}): Promise<DayEvent[]> {
  const { supabase, date, workerId, department } = options;

  const allWorkers = (await fetchWorkersWithFallback(supabase)).filter((worker) => worker.activo);
  const workersByDepartment = department
    ? allWorkers.filter((worker) => (worker.departamento ?? '').toLowerCase() === department.toLowerCase())
    : allWorkers;

  const scopedWorkers = workerId
    ? workersByDepartment.filter((worker) => worker.id === workerId)
    : workersByDepartment;

  if (scopedWorkers.length === 0) return [];

  const workerIds = scopedWorkers.map((worker) => worker.id);

  const { data, error } = await supabase
    .from('fichajes')
    .select('id, trabajador_id, tipo, fichado_en, fecha_laboral, dispositivo_id')
    .eq('fecha_laboral', date)
    .in('trabajador_id', workerIds)
    .order('fichado_en', { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FichajeRow[]).map((fichaje) => {
    return {
      id: fichaje.id,
      nombre: scopedWorkers.find((worker) => worker.id === fichaje.trabajador_id)?.nombre_completo ?? fichaje.trabajador_id,
      hora: new Date(fichaje.fichado_en).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      tipo: fichaje.tipo,
      dispositivo: fichaje.dispositivo_id,
    } as DayEvent;
  });
}
