'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ownerApiDownload, ownerApiFetch } from '@/lib/ownerApiClient';
import styles from './page.module.css';

type CalendarCell = {
  key: string;
  day: number;
  date: Date;
  isCurrentMonth: boolean;
};

type PeriodMode = 'week' | 'month';

type WorkerFilter = {
  id: string;
  nombre_completo: string;
};

type WorkerReportRow = {
  trabajadorId: string;
  nombre: string;
  total: number;
  entradas: number;
  salidas: number;
  lastFichado: string | null;
};

type DayEvent = {
  id: string;
  nombre: string;
  hora: string;
  tipo: 'in' | 'out' | null;
  dispositivo: string | null;
};

type ReportSummary = {
  totalFichajes: number;
  totalEntradas: number;
  totalSalidas: number;
  activos: number;
  ausentes: number;
};

type ReportResponse = {
  rangeLabel: string;
  from: string;
  to: string;
  workers: WorkerFilter[];
  departments: string[];
  rows: WorkerReportRow[];
  events: DayEvent[];
  summary: ReportSummary;
  selectedWorkerLabel: string;
};

type TimelineResponse = {
  events: DayEvent[];
};

function toInputDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getMonthGrid(baseMonth: Date): CalendarCell[] {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const dayOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, idx) => {
    const rawDay = idx - dayOffset + 1;
    if (rawDay <= 0) {
      const day = daysInPrevMonth + rawDay;
      const date = new Date(year, month - 1, day);
      return { key: `prev-${idx}`, day, date, isCurrentMonth: false };
    }
    if (rawDay > daysInMonth) {
      const day = rawDay - daysInMonth;
      const date = new Date(year, month + 1, day);
      return { key: `next-${idx}`, day, date, isCurrentMonth: false };
    }

    const date = new Date(year, month, rawDay);
    return { key: `curr-${idx}`, day: rawDay, date, isCurrentMonth: true };
  });
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const weekDays = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);

  const [monthCursor, setMonthCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const [periodAnchor, setPeriodAnchor] = useState<string>(toInputDate(today));
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [selectedWorkerLabel, setSelectedWorkerLabel] = useState<string>('Todos los trabajadores');
  const [workers, setWorkers] = useState<WorkerFilter[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [reportRows, setReportRows] = useState<WorkerReportRow[]>([]);
  const [periodLastEvents, setPeriodLastEvents] = useState<DayEvent[]>([]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalFichajes: 0,
    totalEntradas: 0,
    totalSalidas: 0,
    activos: 0,
    ausentes: 0,
  });

  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [loadingDay, setLoadingDay] = useState<boolean>(false);
  const [errorReport, setErrorReport] = useState<string | null>(null);
  const [errorDay, setErrorDay] = useState<string | null>(null);

  const calendarCells = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const monthLabel = useMemo(
    () =>
      monthCursor.toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
    [monthCursor],
  );

  const absences = useMemo(() => reportRows.filter((row) => row.total === 0), [reportRows]);
  const topWorkers = useMemo(() => reportRows.filter((row) => row.total > 0).slice(0, 10), [reportRows]);
  const maxWorkerTotal = useMemo(() => Math.max(...topWorkers.map((row) => row.total), 1), [topWorkers]);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    setErrorReport(null);

    try {
      const params = new URLSearchParams({
        mode: periodMode,
        anchor: periodAnchor,
      });

      if (selectedWorkerId) params.set('workerId', selectedWorkerId);
      if (selectedDepartment) params.set('department', selectedDepartment);

      const payload = await ownerApiFetch<ReportResponse>(`/api/owner/reports?${params.toString()}`);
      setRangeLabel(payload.rangeLabel);
      setWorkers(payload.workers);
      setDepartments(payload.departments);
      setReportRows(payload.rows);
      setPeriodLastEvents(payload.events);
      setSummary(payload.summary);
      setSelectedWorkerLabel(payload.selectedWorkerLabel);

      if (selectedWorkerId && !payload.workers.some((worker) => worker.id === selectedWorkerId)) {
        setSelectedWorkerId('');
      }
    } catch (error) {
      setErrorReport(error instanceof Error ? error.message : 'No se pudo generar el informe.');
    } finally {
      setLoadingReport(false);
    }
  }, [periodAnchor, periodMode, selectedDepartment, selectedWorkerId]);

  const loadDayTimeline = useCallback(async () => {
    setLoadingDay(true);
    setErrorDay(null);

    try {
      const params = new URLSearchParams({
        date: toInputDate(selectedDate),
      });

      if (selectedWorkerId) params.set('workerId', selectedWorkerId);
      if (selectedDepartment) params.set('department', selectedDepartment);

      const payload = await ownerApiFetch<TimelineResponse>(`/api/owner/timeline?${params.toString()}`);
      setDayEvents(payload.events);
    } catch (error) {
      setErrorDay(error instanceof Error ? error.message : 'No se pudo cargar el timeline.');
    } finally {
      setLoadingDay(false);
    }
  }, [selectedDate, selectedDepartment, selectedWorkerId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadDayTimeline();
  }, [loadDayTimeline]);

  async function exportReportPdf() {
    setErrorReport(null);

    try {
      const blob = await ownerApiDownload('/api/owner/reports/pdf', {
        method: 'POST',
        body: JSON.stringify({
          mode: periodMode,
          anchor: periodAnchor,
          workerId: selectedWorkerId || undefined,
          department: selectedDepartment || undefined,
        }),
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `informe-trabajadores-${periodAnchor}-${periodMode}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorReport(error instanceof Error ? error.message : 'No se pudo exportar el PDF.');
    }
  }

  function goPrevMonth() {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.leftColumn}>
        <header>
          <h1 className={styles.heroTitle}>Informes de trabajadores</h1>
          <p className={styles.heroText}>
            Visualiza el rendimiento semanal o mensual por trabajador o departamento y detecta ausencias automáticamente.
          </p>
        </header>

        <section className={`${styles.panel} ${styles.reportPanel}`}>
          <div className={styles.panelHeader}>
            <h2>Informe {periodMode === 'week' ? 'semanal' : 'mensual'}</h2>
            <div className={styles.segmented}>
              <button
                type="button"
                onClick={() => setPeriodMode('week')}
                className={`${styles.segmentBtn} ${periodMode === 'week' ? styles.segmentActive : ''}`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`${styles.segmentBtn} ${periodMode === 'month' ? styles.segmentActive : ''}`}
              >
                Mes
              </button>
            </div>
          </div>

          <div className={styles.controls}>
            <label className={styles.controlField}>
              Fecha base
              <input type="date" value={periodAnchor} onChange={(e) => setPeriodAnchor(e.target.value)} />
            </label>
            <label className={styles.controlField}>
              Departamento
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                <option value="">Todos</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.controlField}>
              Trabajador
              <select value={selectedWorkerId} onChange={(e) => setSelectedWorkerId(e.target.value)}>
                <option value="">Todos</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.nombre_completo}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.controlButtons}>
              <button type="button" onClick={() => void loadReport()}>
                Actualizar
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => void exportReportPdf()}>
                Exportar PDF
              </button>
            </div>
          </div>

          <p className={styles.helper}>{rangeLabel}</p>

          <div className={styles.kpiGrid}>
            <article>
              <p className={styles.kpiLabel}>Trabajadores activos</p>
              <p className={styles.kpiValue}>{reportRows.length}</p>
            </article>
            <article>
              <p className={styles.kpiLabel}>Fichajes periodo</p>
              <p className={styles.kpiValue}>{summary.totalFichajes}</p>
            </article>
            <article>
              <p className={styles.kpiLabel}>Entradas / Salidas</p>
              <p className={styles.kpiValue}>
                {summary.totalEntradas} / {summary.totalSalidas}
              </p>
            </article>
          </div>

          {loadingReport && <p className={styles.muted}>Generando informe...</p>}
          {errorReport && <p className="status-error">{errorReport}</p>}
        </section>

        <section className={`${styles.panel} ${styles.chartPanel}`}>
          <div className={styles.panelHeader}>
            <h2>Gráfico por trabajador</h2>
            <span className={styles.badge}>Top {Math.min(topWorkers.length, 10)}</span>
          </div>

          <div className={styles.barList}>
            {topWorkers.map((row) => {
              const width = Math.max((row.total / maxWorkerTotal) * 100, 6);
              return (
                <article key={row.trabajadorId} className={styles.barItem}>
                  <div className={styles.barMeta}>
                    <p className={styles.itemName}>{row.nombre}</p>
                    <strong>{row.total}</strong>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${width}%` }} />
                  </div>
                  <p className={styles.itemSub}>
                    Entradas {row.entradas} · Salidas {row.salidas}
                  </p>
                </article>
              );
            })}
            {!loadingReport && topWorkers.length === 0 && <p className={styles.muted}>No hay fichajes para este periodo.</p>}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.absencePanel}`}>
          <div className={styles.panelHeader}>
            <h2>Ausencias en el periodo</h2>
            <span className={styles.badge}>{summary.ausentes}</span>
          </div>

          <div className={styles.absenceList}>
            {absences.slice(0, 24).map((row) => (
              <span key={row.trabajadorId} className={styles.absenceTag}>
                {row.nombre}
              </span>
            ))}
            {!loadingReport && absences.length === 0 && <p className={styles.muted}>No hay ausencias en el rango seleccionado.</p>}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Últimos fichajes del informe</h2>
            <span className={styles.badge}>{selectedWorkerLabel}</span>
          </div>

          <div className={styles.list}>
            {periodLastEvents.map((event) => (
              <article key={event.id} className={styles.listItem}>
                <div>
                  <p className={styles.itemName}>{event.nombre}</p>
                  <p className={styles.itemSub}>{event.dispositivo ?? 'Sin dispositivo'}</p>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemSub}>{event.hora}</span>
                  <span className={`${styles.pill} ${event.tipo === 'in' ? styles.pillIn : styles.pillOut}`}>
                    {event.tipo ?? '-'}
                  </span>
                </div>
              </article>
            ))}
            {!loadingReport && periodLastEvents.length === 0 && <p className={styles.muted}>Sin fichajes recientes en este periodo.</p>}
          </div>
        </section>
      </section>

      <aside className={styles.rightColumn}>
        <section className={styles.panel}>
          <div className={styles.calendarHead}>
            <h2>{monthLabel}</h2>
            <div className={styles.calendarNav}>
              <button type="button" className={styles.navBtn} onClick={goPrevMonth}>
                ◀
              </button>
              <button type="button" className={styles.navBtn} onClick={goNextMonth}>
                ▶
              </button>
            </div>
          </div>

          <div className={styles.weekGrid}>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.daysGrid}>
            {calendarCells.map((cell) => {
              const isToday = isSameDate(cell.date, today);
              const isSelected = isSameDate(cell.date, selectedDate);

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={`${styles.dayBtn} ${!cell.isCurrentMonth ? styles.dayMuted : ''} ${
                    isToday ? styles.dayToday : ''
                  } ${isSelected ? styles.daySelected : ''}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <p className={styles.helper}>Selecciona un día para ver fichajes del timeline.</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Timeline diario</h2>
            <span className={styles.badge}>{selectedDate.toLocaleDateString('es-ES')}</span>
          </div>

          {loadingDay && <p className={styles.muted}>Cargando timeline...</p>}
          {errorDay && <p className="status-error">{errorDay}</p>}

          <div className={styles.list}>
            {dayEvents.map((event) => (
              <article key={event.id} className={styles.listItem}>
                <div>
                  <p className={styles.itemName}>{event.nombre}</p>
                  <p className={styles.itemSub}>{event.dispositivo ?? 'Sin dispositivo'}</p>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemSub}>{event.hora}</span>
                  <span className={`${styles.pill} ${event.tipo === 'in' ? styles.pillIn : styles.pillOut}`}>
                    {event.tipo ?? '-'}
                  </span>
                </div>
              </article>
            ))}
            {!loadingDay && dayEvents.length === 0 && <p className={styles.muted}>No hay fichajes para esta fecha.</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}
