'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './page.module.css';

type FicharRpcResult = {
  success: boolean;
  tipo?: 'in' | 'out' | string | null;
  fichado_en?: string | null;
  fecha_laboral?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES');
}

function getStatusLabel(loading: boolean, errorMsg: string | null, lastResult: FicharRpcResult | null) {
  if (loading) return 'Procesando lectura...';
  if (errorMsg) return 'Error en fichaje';
  if (lastResult?.success) return 'Último fichaje validado';
  return 'Esperando tarjeta';
}

export default function FicharPage() {
  const [uid, setUid] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<FicharRpcResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const timer = window.setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 800);

    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Aquí se captura el UID que llega del lector (termina con Enter).
    const scannedUid = uid.trim();
    if (!scannedUid || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // Aquí se llama a la RPC de Supabase para registrar el fichaje.
      const { data, error } = await supabase.rpc('fichar_por_uid', {
        p_uid_fisico: scannedUid,
        p_dispositivo_id: 'lector-caja-1',
      });

      if (error) {
        setLastResult(null);
        setErrorMsg(error.message);
        return;
      }

      const result = (data ?? null) as FicharRpcResult | null;
      setLastResult(result);

      if (!result?.success) {
        setErrorMsg(result?.error_message ?? 'No se pudo registrar el fichaje');
      }
    } finally {
      setUid('');
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const statusLabel = getStatusLabel(loading, errorMsg, lastResult);

  return (
    <section className={styles.page}>
      <header>
        <h1 className="page-title">Terminal de fichaje</h1>
        <p className="page-subtitle">Acerca la tarjeta al lector NFC USB para registrar entrada o salida.</p>
      </header>

      <div className={styles.gridCols2}>
        <article className={`${styles.card} ${styles.yellow}`}>
          <h2 className={styles.title}>Escaneo rápido</h2>
          <p className={styles.text}>El lector escribe el UID y envía Enter automáticamente.</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="uid-input" className={styles.label}>
              UID leído
            </label>
            <input
              id="uid-input"
              ref={inputRef}
              autoFocus
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onBlur={() => inputRef.current?.focus()}
              placeholder="Esperando lectura..."
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" disabled={loading || uid.trim().length === 0}>
              {loading ? 'Registrando...' : 'Registrar fichaje'}
            </button>
          </form>
        </article>

        <article className={`${styles.card} ${styles.blue}`}>
          <h2 className={styles.title}>Estado</h2>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${loading ? styles.dotLoading : styles.dotIdle}`} />
            <strong>{statusLabel}</strong>
          </div>
          <p className={styles.text}>El foco del campo UID se mantiene para lecturas continuas.</p>
        </article>
      </div>

      <article className={`${styles.card} ${styles.pink}`}>
        <h2 className={styles.title}>Último resultado</h2>
        {/* Aquí se muestra el resultado del último fichaje. */}
        {errorMsg && <p className="status-error">Error: {errorMsg}</p>}
        {!errorMsg && lastResult?.success && (
          <p className="status-ok">
            Fichaje OK - tipo: {lastResult.tipo ?? '-'}, hora: {formatDateTime(lastResult.fichado_en)}
          </p>
        )}
        {!errorMsg && !lastResult && <p className={styles.text}>Todavía no hay lecturas en esta sesión.</p>}

        <pre className={styles.pre}>{lastResult ? JSON.stringify(lastResult, null, 2) : '{ }'}</pre>
      </article>
    </section>
  );
}
