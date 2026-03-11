'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppConfigData } from '@/app/api/settings/route';
import styles from '@/app/_styles/ops.module.css';

const DEFAULTS: AppConfigData = {
  businessName: 'Santa Marta',
  welcomeText: 'Panel principal',
  terminalName: 'lector-caja-1',
  fichajeToleranceMinutes: 5,
  timeFormat24h: true,
  giftCardDefaultAmounts: [20, 30, 50, 100],
  giftCardExpiryMonths: 0,
  giftCardsRechargeable: true,
  newEmployeeActiveByDefault: true,
  theme: 'light',
  fontSize: 'normal',
};

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyThemeAndFont(config: AppConfigData) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.theme = resolveTheme(config.theme);
  html.dataset.themePreference = config.theme;
  html.dataset.fontSize = config.fontSize;
}

export default function AjustesPage() {
  const [config, setConfig] = useState<AppConfigData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [giftAmountsText, setGiftAmountsText] = useState('20, 30, 50, 100');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al cargar ajustes');
      }
      const data = (await res.json()) as AppConfigData;
      setConfig(data);
      setGiftAmountsText(data.giftCardDefaultAmounts.join(', '));
      applyThemeAndFont(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ajustes');
      setConfig(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    const amounts = giftAmountsText
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const payload: AppConfigData = {
      ...config,
      giftCardDefaultAmounts: amounts.length > 0 ? amounts : DEFAULTS.giftCardDefaultAmounts,
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al guardar');
      }

      applyThemeAndFont(payload);
      setInfo('Ajustes guardados correctamente.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar ajustes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={styles.page}>
        <p className={styles.muted}>Cargando ajustes...</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Ajustes</h1>
        <p>Personaliza el panel y el comportamiento del restaurante.</p>
      </header>

      {error && <p className="status-error">{error}</p>}
      {info && <p className="status-ok">{info}</p>}

      <form onSubmit={handleSave}>
        {/* Identidad del local */}
        <article className={`${styles.card} ${styles.cardPink}`}>
          <h2 className={styles.cardTitle}>Identidad del local</h2>
          <p className={styles.cardText}>Nombre y textos que verás en el panel.</p>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.metaLabel}>Nombre comercial</label>
              <input
                value={config.businessName}
                onChange={(e) => setConfig((c) => ({ ...c, businessName: e.target.value }))}
                placeholder="Santa Marta"
              />
            </div>
            <div>
              <label className={styles.metaLabel}>Texto de bienvenida (subtítulo)</label>
              <input
                value={config.welcomeText}
                onChange={(e) => setConfig((c) => ({ ...c, welcomeText: e.target.value }))}
                placeholder="Panel principal"
              />
            </div>
          </div>
        </article>

        {/* Terminales y fichajes */}
        <article className={`${styles.card} ${styles.cardYellow}`}>
          <h2 className={styles.cardTitle}>Terminales y fichajes</h2>
          <p className={styles.cardText}>Nombre del terminal y reglas de fichaje.</p>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.metaLabel}>Nombre del terminal activo</label>
              <input
                value={config.terminalName}
                onChange={(e) => setConfig((c) => ({ ...c, terminalName: e.target.value }))}
                placeholder="lector-caja-1"
              />
            </div>
            <div>
              <label className={styles.metaLabel}>Tolerancia en fichajes (minutos)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={config.fichajeToleranceMinutes}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, fichajeToleranceMinutes: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <label className={styles.row} style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.timeFormat24h}
                onChange={(e) => setConfig((c) => ({ ...c, timeFormat24h: e.target.checked }))}
              />
              <span>Usar formato 24 horas</span>
            </label>
          </div>
        </article>

        {/* Tarjetas regalo */}
        <article className={`${styles.card} ${styles.cardGreen}`}>
          <h2 className={styles.cardTitle}>Tarjetas regalo</h2>
          <p className={styles.cardText}>Importes rápidos, caducidad y recargas.</p>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.metaLabel}>Importes rápidos por defecto (€, separados por comas)</label>
              <input
                value={giftAmountsText}
                onChange={(e) => setGiftAmountsText(e.target.value)}
                placeholder="20, 30, 50, 100"
              />
            </div>
            <div>
              <label className={styles.metaLabel}>Caducidad por defecto (meses, 0 = sin caducidad)</label>
              <input
                type="number"
                min={0}
                value={config.giftCardExpiryMonths}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, giftCardExpiryMonths: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
            </div>
            <label className={styles.row} style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.giftCardsRechargeable}
                onChange={(e) => setConfig((c) => ({ ...c, giftCardsRechargeable: e.target.checked }))}
              />
              <span>Permitir recargar saldo en tarjetas regalo</span>
            </label>
          </div>
        </article>

        {/* Empleados */}
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Empleados</h2>
          <p className={styles.cardText}>Opciones al dar de alta.</p>
          <label className={styles.row} style={{ alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={config.newEmployeeActiveByDefault}
              onChange={(e) => setConfig((c) => ({ ...c, newEmployeeActiveByDefault: e.target.checked }))}
            />
            <span>Nuevos empleados activos por defecto</span>
          </label>
        </article>

        {/* Apariencia */}
        <article className={`${styles.card} ${styles.cardBlue}`}>
          <h2 className={styles.cardTitle}>Apariencia</h2>
          <p className={styles.cardText}>Tema y tamaño de fuente del panel.</p>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.metaLabel}>Tema</label>
              <select
                value={config.theme}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    theme: e.target.value as 'light' | 'dark' | 'system',
                  }))
                }
              >
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="system">Según el sistema</option>
              </select>
            </div>
            <div>
              <label className={styles.metaLabel}>Tamaño de fuente</label>
              <select
                value={config.fontSize}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    fontSize: e.target.value as 'normal' | 'large',
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>
        </article>

        <div className={styles.actions} style={{ marginTop: 16 }}>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </form>
    </section>
  );
}
