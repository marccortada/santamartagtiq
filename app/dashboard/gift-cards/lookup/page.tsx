'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/app/_styles/ops.module.css';

type GiftCard = {
  id: string;
  label: string;
  initial_amount: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  expires_at: string | null;
};

export default function GiftCardLookupPage() {
  const [name, setName] = useState('');
  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCard(null);

    try {
      const term = name.trim();
      if (!term) {
        setError('Introduce un nombre para buscar la tarjeta.');
        return;
      }

      const { data, error: queryError } = await supabase
        .from('gift_cards')
        .select('id, label, initial_amount, current_balance, currency, is_active, expires_at')
        .ilike('label', `%${term}%`);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      const first = (data ?? [])[0] as GiftCard | undefined;
      if (!first) {
        setError('No se encontró ninguna tarjeta para ese nombre.');
        return;
      }

      setCard(first);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Buscar tarjeta regalo por nombre</h1>
        <p>Consulta rápida del estado y saldo de una tarjeta regalo usando el nombre de la persona.</p>
      </header>

      <article className={`${styles.card} ${styles.cardBlue}`}>
        <h2 className={styles.cardTitle}>Buscar tarjeta</h2>
        <p className={styles.cardText}>Escribe el nombre de la persona tal y como se registró en la tarjeta.</p>

        <form onSubmit={onLookup} className={`${styles.row} ${styles.mt12}`}>
          <input
            className={styles.grow}
            placeholder="Nombre de la persona (MAYÚSCULAS)"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase' }}
            required
          />
          <button type="submit" disabled={loading || name.trim().length === 0}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </article>

      {loading && <p className={styles.muted}>Buscando...</p>}
      {error && <p className="status-error">{error}</p>}

      {card && (
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Resultado</h2>
          <div className={`${styles.metaGrid} ${styles.mt12}`}>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>Nombre</p>
              <p className={styles.metaValue}>{card.label}</p>
            </div>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>Saldo</p>
              <p className={styles.metaValue}>
                {card.current_balance} {card.currency}
              </p>
            </div>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>Inicial</p>
              <p className={styles.metaValue}>
                {card.initial_amount} {card.currency}
              </p>
            </div>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>Activa</p>
              <p className={styles.metaValue}>{card.is_active ? 'Sí' : 'No'}</p>
            </div>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>Caduca</p>
              <p className={styles.metaValue}>{card.expires_at ? new Date(card.expires_at).toLocaleString('es-ES') : '-'}</p>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
