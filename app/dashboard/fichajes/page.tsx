'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

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
  trabajadores: { id: string; nombre_completo: string } | null;
  tarjetas: { id: string; uid_fisico: string; numero_logico: number } | null;
};

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
  const [uidInput, setUidInput] = useState<string>('');
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
      setLoading(false);
      return;
    }

    setFichajes((data ?? []) as FichajeRow[]);
    setLoading(false);
  }, [fromDate, toDate, trabajadorId]);

  useEffect(() => {
    void loadTrabajadores();
  }, [loadTrabajadores]);

  useEffect(() => {
    void loadFichajes();
  }, [loadFichajes]);

  const onFicharPorUid = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const { data, error: rpcError } = await supabase.rpc('fichar_por_uid', {
      p_uid_fisico: uidInput,
      p_dispositivo_id: dispositivoInput || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (!data?.success) {
      setError(data?.error_message ?? 'No se pudo registrar el fichaje');
      return;
    }

    setInfo(`Fichaje OK: ${data.tipo} · ${new Date(data.fichado_en).toLocaleString('es-ES')}`);
    setUidInput('');
    await loadFichajes();
  };

  return (
    <section>
      <h2>Fichajes</h2>

      <form onSubmit={onFicharPorUid} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <h3>Fichar por UID (RPC)</h3>
        <input
          placeholder="UID tarjeta empleado"
          value={uidInput}
          onChange={(e) => setUidInput(e.target.value)}
          required
        />
        <input
          placeholder="Dispositivo (opcional)"
          value={dispositivoInput}
          onChange={(e) => setDispositivoInput(e.target.value)}
        />
        <button type="submit">Registrar fichaje</button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
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

      {loading && <p>Cargando fichajes...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {info && <p style={{ color: 'green' }}>{info}</p>}

      <table cellPadding={8} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Fecha</th>
            <th align="left">Hora</th>
            <th align="left">Tipo</th>
            <th align="left">Trabajador</th>
            <th align="left">Tarjeta</th>
            <th align="left">Dispositivo</th>
          </tr>
        </thead>
        <tbody>
          {fichajes.map((f) => {
            const dt = formatDateTime(f.fichado_en);
            return (
              <tr key={f.id}>
                <td>{dt.fecha}</td>
                <td>{dt.hora}</td>
                <td>{f.tipo ?? '-'}</td>
                <td>{f.trabajadores?.nombre_completo ?? f.trabajador_id}</td>
                <td>{f.tarjetas ? `#${f.tarjetas.numero_logico} · ${f.tarjetas.uid_fisico}` : '-'}</td>
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
    </section>
  );
}
