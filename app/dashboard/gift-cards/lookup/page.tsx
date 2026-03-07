'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/app/_styles/ops.module.css';

type GiftCard = {
  id: string;
  label: string;
  nfc_uid: string;
  initial_amount: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  expires_at: string | null;
};

export default function GiftCardLookupPage() {
  const [uid, setUid] = useState('');
  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCard(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_gift_card_by_uid', {
        p_nfc_uid: uid.trim(),
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const normalized = Array.isArray(data) ? data[0] : data;
      setCard((normalized as GiftCard) ?? null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Lookup de tarjeta por UID</h1>
        <p>Consulta rápida del estado y saldo de una tarjeta NFC.</p>
      </header>

      <article className={`${styles.card} ${styles.cardBlue}`}>
        <h2 className={styles.cardTitle}>Buscar tarjeta</h2>
        <p className={styles.cardText}>Introduce un UID leído desde el lector NFC.</p>

        <form onSubmit={onLookup} className={`${styles.row} ${styles.mt12}`}>
          <input
            className={styles.grow}
            placeholder="UID NFC"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            required
          />
          <button type="submit" disabled={loading || uid.trim().length === 0}>
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
              <p className={styles.metaLabel}>Label</p>
              <p className={styles.metaValue}>{card.label}</p>
            </div>
            <div className={styles.metaItem}>
              <p className={styles.metaLabel}>UID</p>
              <p className={styles.metaValue}>{card.nfc_uid}</p>
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
