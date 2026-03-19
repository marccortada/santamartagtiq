'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './page.module.css';

type FicharRpcResult = {
  success: boolean;
  tipo?: 'in' | 'out' | string | null;
  fichado_en?: string | null;
  fecha_laboral?: string | null;
  error_message?: string | null;
  nombre_completo?: string | null;
  trabajador_nombre?: string | null;
  [key: string]: unknown;
};

type UiPhase = 'idle' | 'loading' | 'success' | 'error';

const TERMINAL_ID =
  process.env.NEXT_PUBLIC_KIOSK_TERMINAL_ID?.trim() || 'lector-caja-1';

const RESET_MS = 4500;

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function tipoLabel(tipo?: string | null) {
  if (tipo === 'in') return 'Entrada';
  if (tipo === 'out') return 'Salida';
  return tipo ? String(tipo) : '';
}

function playTone(kind: 'ok' | 'err') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'ok' ? 0.12 : 0.25));
  } catch {
    /* sin audio en algunos navegadores */
  }
}

export default function KioskFichajePage() {
  const [uid, setUid] = useState('');
  const [phase, setPhase] = useState<UiPhase>('idle');
  const [lastResult, setLastResult] = useState<FicharRpcResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
    const t = window.setInterval(() => {
      if (document.activeElement !== inputRef.current) focusInput();
    }, 600);
    return () => window.clearInterval(t);
  }, [focusInput]);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setPhase('idle');
      setLastResult(null);
      setErrorMsg(null);
      focusInput();
    }, RESET_MS);
  }, [focusInput]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const scanned = uid.trim();
    if (!scanned || phase === 'loading') return;

    setPhase('loading');
    setErrorMsg(null);
    setLastResult(null);

    try {
      const { data, error } = await supabase.rpc('fichar_por_uid', {
        p_uid_fisico: scanned,
        p_dispositivo_id: TERMINAL_ID,
      });

      if (error) {
        setPhase('error');
        setErrorMsg(error.message);
        playTone('err');
        scheduleReset();
        return;
      }

      const result = (data ?? null) as FicharRpcResult | null;
      setLastResult(result);

      if (!result?.success) {
        setPhase('error');
        setErrorMsg(result?.error_message ?? 'No se pudo registrar el fichaje');
        playTone('err');
      } else {
        setPhase('success');
        playTone('ok');
      }
      scheduleReset();
    } finally {
      setUid('');
      focusInput();
    }
  }

  const rootClass =
    phase === 'loading'
      ? styles.rootLoading
      : phase === 'success'
        ? styles.rootSuccess
        : phase === 'error'
          ? styles.rootError
          : styles.rootIdle;

  const nombre =
    lastResult?.nombre_completo ??
    lastResult?.trabajador_nombre ??
    (typeof lastResult?.nombre === 'string' ? lastResult.nombre : null);

  return (
    <div className={`${styles.root} ${rootClass}`}>
      <header className={styles.header}>
        <p className={styles.brand}>Santa Marta</p>
        <h1 className={styles.title}>Fichaje</h1>
        <p className={styles.subtitle}>Pasa la tarjeta por el lector NFC</p>
      </header>

      <form onSubmit={handleSubmit} className={styles.stage} aria-hidden>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          onBlur={() => inputRef.current?.focus()}
          disabled={phase === 'loading'}
          aria-label="Lector NFC"
        />
      </form>

      <div className={styles.feedback}>
        {phase === 'idle' && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconIdle}`} aria-hidden>
              ⌁
            </div>
            <p className={styles.statusLine}>Listo para fichar</p>
            <p className={styles.hint}>Acerca la tarjeta al lector</p>
          </>
        )}

        {phase === 'loading' && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconLoading}`} aria-hidden>
              …
            </div>
            <p className={styles.statusLine}>Registrando…</p>
            <p className={styles.hint}>Espera un momento</p>
          </>
        )}

        {phase === 'success' && lastResult?.success && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`} aria-hidden>
              ✓
            </div>
            <p className={styles.statusLine}>Fichaje correcto</p>
            {nombre && <p className={styles.detail}>{nombre}</p>}
            <p className={styles.detail}>
              {tipoLabel(lastResult.tipo)} · {formatTime(lastResult.fichado_en)}
            </p>
            {lastResult.fecha_laboral && (
              <p className={styles.hint}>{formatDate(lastResult.fecha_laboral)}</p>
            )}
          </>
        )}

        {phase === 'error' && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconError}`} aria-hidden>
              ✕
            </div>
            <p className={styles.statusLine}>No se ha podido fichar</p>
            <p className={styles.detail}>{errorMsg ?? 'Inténtalo de nuevo'}</p>
          </>
        )}
      </div>

      <footer className={styles.footer}>
        Terminal: {TERMINAL_ID} · La pantalla vuelve sola en unos segundos
      </footer>
    </div>
  );
}
