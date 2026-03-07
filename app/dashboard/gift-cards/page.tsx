'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  created_at: string;
};

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [nfcUid, setNfcUid] = useState('');
  const [initialAmount, setInitialAmount] = useState('100.00');
  const [expiresAt, setExpiresAt] = useState('');

  const loadGiftCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('gift_cards')
        .select('id, label, nfc_uid, initial_amount, current_balance, currency, is_active, expires_at, created_at')
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setCards((data ?? []) as GiftCard[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGiftCards();
  }, [loadGiftCards]);

  const onCreateCard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsedAmount = Number(initialAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('El importe inicial debe ser mayor que 0');
      return;
    }

    const payload = {
      label: label.trim(),
      nfc_uid: nfcUid.trim(),
      initial_amount: parsedAmount,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    const { error: insertError } = await supabase.from('gift_cards').insert(payload);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setInfo('Tarjeta regalo creada');
    setLabel('');
    setNfcUid('');
    setInitialAmount('100.00');
    setExpiresAt('');
    await loadGiftCards();
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Tarjetas regalo</h1>
        <p>Gestión de tarjetas NFC: alta, saldo actual y acceso al detalle de movimientos.</p>
      </header>

      <article className={`${styles.card} ${styles.cardPink}`}>
        <h2 className={styles.cardTitle}>Nueva tarjeta regalo</h2>
        <p className={styles.cardText}>Crea una tarjeta vinculando etiqueta, UID e importe inicial.</p>

        <form onSubmit={onCreateCard} className={styles.formGrid}>
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
          <input placeholder="NFC UID" value={nfcUid} onChange={(e) => setNfcUid(e.target.value)} required />
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Importe inicial"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            required
          />
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <button type="submit">Crear tarjeta</button>
        </form>
      </article>

      {loading && <p className={styles.muted}>Cargando tarjetas...</p>}
      {error && <p className="status-error">{error}</p>}
      {info && <p className="status-ok">{info}</p>}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>UID</th>
              <th>Inicial</th>
              <th>Saldo</th>
              <th>Activa</th>
              <th>Caduca</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>{card.label}</td>
                <td>{card.nfc_uid}</td>
                <td>
                  {card.initial_amount} {card.currency}
                </td>
                <td>
                  {card.current_balance} {card.currency}
                </td>
                <td>{card.is_active ? 'Sí' : 'No'}</td>
                <td>{card.expires_at ? new Date(card.expires_at).toLocaleString('es-ES') : '-'}</td>
                <td>
                  <Link className={styles.link} href={`/dashboard/gift-cards/${card.id}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && cards.length === 0 && (
              <tr>
                <td colSpan={7}>No hay tarjetas regalo todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
