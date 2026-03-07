'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ownerApiFetch } from '@/lib/ownerApiClient';
import styles from './page.module.css';

type DayEvent = {
  id: string;
  nombre: string;
  hora: string;
  tipo: 'in' | 'out' | null;
  dispositivo: string | null;
};

type TimelineResponse = {
  events: DayEvent[];
};

type FicharRpcResult = {
  success: boolean;
  tipo?: 'in' | 'out' | string | null;
  fichado_en?: string | null;
  error_message?: string | null;
};

type CalendarCell = {
  key: string;
  day: number;
  date: Date;
  isCurrentMonth: boolean;
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

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES');
}

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uid, setUid] = useState<string>('');
  const [loadingFichar, setLoadingFichar] = useState<boolean>(false);
  const [ficharError, setFicharError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FicharRpcResult | null>(null);

  const [monthCursor, setMonthCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [events, setEvents] = useState<DayEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const calendarCells = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const monthLabel = useMemo(
    () =>
      monthCursor.toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
    [monthCursor],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadTimeline = useCallback(async () => {
    setLoadingEvents(true);
    setEventsError(null);

    try {
      const date = toInputDate(selectedDate);
      const payload = await ownerApiFetch<TimelineResponse>(`/api/owner/timeline?date=${date}`);
      setEvents(payload.events);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'No se pudo cargar los fichajes recientes.');
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function handleFichar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const scannedUid = uid.trim();
    if (!scannedUid || loadingFichar) return;

    setLoadingFichar(true);
    setFicharError(null);

    try {
      const { data, error } = await supabase.rpc('fichar_por_uid', {
        p_uid_fisico: scannedUid,
        p_dispositivo_id: 'lector-caja-1',
      });

      if (error) {
        setFicharError(error.message);
        setLastResult(null);
        return;
      }

      const result = (data ?? null) as FicharRpcResult | null;
      setLastResult(result);

      if (!result?.success) {
        setFicharError(result?.error_message ?? 'No se pudo registrar el fichaje.');
      } else {
        await loadTimeline();
      }
    } finally {
      setUid('');
      setLoadingFichar(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.leftColumn}>
        <header>
          <h1 className={styles.heroTitle}>Dashboard</h1>
          <p className={styles.heroText}>Fichaje rápido por UID y control diario de fichajes recientes.</p>
        </header>

        <article className={styles.panel}>
          <h2>Fichar por UID</h2>
          <p className={styles.helper}>Pasa la tarjeta o escribe el UID y pulsa Enter.</p>

          <form onSubmit={handleFichar} className={styles.form}>
            <input
              ref={inputRef}
              autoFocus
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onBlur={() => inputRef.current?.focus()}
              placeholder="UID tarjeta"
              disabled={loadingFichar}
              autoComplete="off"
            />
            <button type="submit" disabled={loadingFichar || uid.trim().length === 0}>
              {loadingFichar ? 'Fichando...' : 'Registrar fichaje'}
            </button>
          </form>

          {ficharError && <p className="status-error">{ficharError}</p>}
          {!ficharError && lastResult?.success && (
            <p className="status-ok">
              Fichaje OK - tipo: {lastResult.tipo ?? '-'}, hora: {formatDateTime(lastResult.fichado_en)}
            </p>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Fichajes recientes</h2>
            <span className={styles.badge}>{selectedDate.toLocaleDateString('es-ES')}</span>
          </div>

          {loadingEvents && <p className={styles.helper}>Cargando fichajes...</p>}
          {eventsError && <p className="status-error">{eventsError}</p>}

          <div className={styles.list}>
            {events.map((eventItem) => (
              <article key={eventItem.id} className={styles.listItem}>
                <div>
                  <p className={styles.itemName}>{eventItem.nombre}</p>
                  <p className={styles.itemSub}>{eventItem.dispositivo ?? 'Sin dispositivo'}</p>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemSub}>{eventItem.hora}</span>
                  <span className={`${styles.pill} ${eventItem.tipo === 'in' ? styles.pillIn : styles.pillOut}`}>
                    {eventItem.tipo ?? '-'}
                  </span>
                </div>
              </article>
            ))}
            {!loadingEvents && events.length === 0 && <p className={styles.helper}>No hay fichajes para esta fecha.</p>}
          </div>
        </article>
      </section>

      <aside className={styles.rightColumn}>
        <section className={styles.panel}>
          <div className={styles.calendarHead}>
            <h2>{monthLabel}</h2>
            <div className={styles.calendarNav}>
              <button type="button" className={styles.navBtn} onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                ◀
              </button>
              <button type="button" className={styles.navBtn} onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
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
                  className={`${styles.dayBtn} ${!cell.isCurrentMonth ? styles.dayMuted : ''} ${isToday ? styles.dayToday : ''} ${
                    isSelected ? styles.daySelected : ''
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <p className={styles.helper}>Selecciona un día para ver los fichajes recientes.</p>
        </section>
      </aside>
    </div>
  );
}
