"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/app/_styles/ops.module.css';

type Trabajador = {
  id: string;
  nombre_completo: string;
  numero_logico: number;
};

type FichajeRow = {
  id: string;
  trabajador_id: string;
  tipo: 'in' | 'out' | null;
  fichado_en: string;
  fecha_laboral: string;
  dispositivo_id: string | null;
  trabajadores: { id: string; nombre_completo: string } | { id: string; nombre_completo: string }[] | null;
  tarjetas:
    | { id: string; uid_fisico: string; numero_logico: number }
    | { id: string; uid_fisico: string; numero_logico: number }[]
    | null;
};

type FicharPorUidResult = {
  success: boolean;
  tipo?: 'in' | 'out' | null;
  fichado_en?: string;
  error_message?: string;
};

function unwrapRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toInputDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { from: toInputDate(monday), to: toInputDate(sunday) };
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-ES'),
    hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export default function FichajesPage() {
  const week = useMemo(() => getCurrentWeekRange(), []);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [fichajes, setFichajes] = useState<FichajeRow[]>([]);
  const [trabajadorId, setTrabajadorId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(week.from);
  const [toDate, setToDate] = useState<string>(week.to);
  const [manualTrabajadorId, setManualTrabajadorId] = useState<string>('');
  const [dispositivoInput, setDispositivoInput] = useState<string>('lector-caja-1');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadTrabajadores = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('trabajadores')
      .select('id, nombre_completo, numero_logico')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setTrabajadores((data ?? []) as Trabajador[]);
  }, []);

  const loadFichajes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('fichajes')
        .select(
          `
          id,
          trabajador_id,
          tipo,
          fichado_en,
          fecha_laboral,
          dispositivo_id,
          trabajadores:trabajador_id ( id, nombre_completo ),
          tarjetas:tarjeta_id ( id, uid_fisico, numero_logico )
        `,
        )
        .gte('fecha_laboral', fromDate)
        .lte('fecha_laboral', toDate)
        .order('fichado_en', { ascending: false });

      if (trabajadorId) {
        query = query.eq('trabajador_id', trabajadorId);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        setError(queryError.message);
        return;
      }

      setFichajes((data ?? []) as FichajeRow[]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, trabajadorId]);

  useEffect(() => {
    void loadTrabajadores();
  }, [loadTrabajadores]);

  useEffect(() => {
    void loadFichajes();
  }, [loadFichajes]);

  const onFicharManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!manualTrabajadorId) {
      setError('Selecciona un trabajador para fichar.');
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('fichar_por_trabajador_id', {
      p_trabajador_id: manualTrabajadorId,
      p_dispositivo_id: dispositivoInput.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = (data ?? null) as FicharPorUidResult | null;
    if (!result?.success) {
      setError(result?.error_message ?? 'No se pudo registrar el fichaje');
      return;
    }

    setInfo(`Fichaje OK: ${result.tipo ?? '-'} · ${new Date(result.fichado_en ?? '').toLocaleString('es-ES')}`);
    await loadFichajes();
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Fichajes</h1>
        <p>Registro manual por UID y consulta de actividad por trabajador/rango de fechas.</p>
      </header>

      <div className={styles.gridCols2}>
        <article className={`${styles.card} ${styles.cardYellow}`}>
          <h2 className={styles.cardTitle}>Fichar manualmente</h2>
          <p className={styles.cardText}>Por si el lector NFC falla: selecciona un trabajador y registra su fichaje.</p>

          <form onSubmit={onFicharManual} className={styles.formGrid}>
            <select
              value={manualTrabajadorId}
              onChange={(e) => setManualTrabajadorId(e.target.value)}
              required
            >
              <option value="">Selecciona trabajador...</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre_completo} (#{t.numero_logico})
                </option>
              ))}
            </select>
            <input
              placeholder="Dispositivo (opcional)"
              value={dispositivoInput}
              onChange={(e) => setDispositivoInput(e.target.value)}
            />
            <button type="submit" disabled={loading || !manualTrabajadorId}>
              {loading ? 'Registrando...' : 'Fichar ahora'}
            </button>
          </form>
        </article>

        <article className={`${styles.card} ${styles.cardBlue}`}>
          <h2 className={styles.cardTitle}>Filtros</h2>
          <p className={styles.cardText}>Acota por trabajador y fecha laboral.</p>

          <div className={`${styles.formGrid} ${styles.actions}`}>
            <select className={styles.grow} value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
              <option value="">Todos los trabajadores</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre_completo} (#{t.numero_logico})
                </option>
              ))}
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button type="button" onClick={() => void loadFichajes()}>
              Aplicar filtros
            </button>
          </div>
        </article>
      </div>

      {loading && <p className={styles.muted}>Cargando fichajes...</p>}
      {error && <p className="status-error">{error}</p>}
      {info && <p className="status-ok">{info}</p>}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Trabajador</th>
              <th>Tarjeta</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            {fichajes.map((f) => {
              const dt = formatDateTime(f.fichado_en);
              const trabajador = unwrapRelation(f.trabajadores);
              const tarjeta = unwrapRelation(f.tarjetas);
              return (
                <tr key={f.id}>
                  <td>{dt.fecha}</td>
                  <td>{dt.hora}</td>
                  <td>{f.tipo ?? '-'}</td>
                  <td>{trabajador?.nombre_completo ?? f.trabajador_id}</td>
                  <td>{tarjeta ? `#${tarjeta.numero_logico} · ${tarjeta.uid_fisico}` : '-'}</td>
                  <td>{f.dispositivo_id ?? '-'}</td>
                </tr>
              );
            })}
            {!loading && fichajes.length === 0 && (
              <tr>
                <td colSpan={6}>Sin fichajes para el filtro seleccionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
