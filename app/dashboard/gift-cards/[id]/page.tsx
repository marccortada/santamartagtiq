'use client';

import { useParams } from 'next/navigation';
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
};

type GiftCardTx = {
  id: string;
  type: 'redeem' | 'top_up';
  amount: number;
  description: string | null;
  created_at: string;
};

type RedeemResult = {
  success: boolean;
  error_message?: string;
  new_balance?: number;
};

export default function GiftCardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [card, setCard] = useState<GiftCard | null>(null);
  const [txs, setTxs] = useState<GiftCardTx[]>([]);
  const [amount, setAmount] = useState('0.00');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('ID de tarjeta no válido.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardQuery = supabase
        .from('gift_cards')
        .select('id, label, nfc_uid, initial_amount, current_balance, currency, is_active, expires_at')
        .eq('id', id)
        .single();

      const txQuery = supabase
        .from('gift_card_transactions')
        .select('id, type, amount, description, created_at')
        .eq('gift_card_id', id)
        .order('created_at', { ascending: false });

      const [{ data: cardData, error: cardError }, { data: txData, error: txError }] = await Promise.all([
        cardQuery,
        txQuery,
      ]);

      if (cardError) {
        setError(cardError.message);
        return;
      }
      if (txError) {
        setError(txError.message);
        return;
      }

      setCard(cardData as GiftCard);
      setTxs((txData ?? []) as GiftCardTx[]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const onRedeem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!card) return;

    setError(null);
    setInfo(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('El importe debe ser mayor que 0');
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('redeem_gift_card_by_uid', {
      p_nfc_uid: card.nfc_uid,
      p_amount: parsedAmount,
      p_description: description.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = (data ?? null) as RedeemResult | null;
    if (!result?.success) {
      setError(result?.error_message ?? 'No se pudo registrar el consumo');
      return;
    }

    setInfo(`Consumo registrado. Nuevo saldo: ${result.new_balance ?? '-'} ${card.currency}`);
    setAmount('0.00');
    setDescription('');
    await loadDetail();
  };

  if (loading) {
    return <p className={styles.muted}>Cargando detalle...</p>;
  }

  if (!card) {
    return <p className="status-error">{error ?? 'No se encontró la tarjeta.'}</p>;
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Detalle de tarjeta regalo</h1>
        <p>Consulta de saldo y registro de consumos sobre la tarjeta seleccionada.</p>
      </header>

      {error && <p className="status-error">{error}</p>}
      {info && <p className="status-ok">{info}</p>}

      <article className={`${styles.card} ${styles.cardGreen}`}>
        <h2 className={styles.cardTitle}>Ficha de tarjeta</h2>
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
            <p className={styles.metaLabel}>Inicial</p>
            <p className={styles.metaValue}>
              {card.initial_amount} {card.currency}
            </p>
          </div>
          <div className={styles.metaItem}>
            <p className={styles.metaLabel}>Saldo actual</p>
            <p className={styles.metaValue}>
              {card.current_balance} {card.currency}
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

      <div className={styles.gridCols2}>
        <article className={`${styles.card} ${styles.cardYellow}`}>
          <h2 className={styles.cardTitle}>Registrar consumo (RPC)</h2>
          <p className={styles.cardText}>Descuenta saldo desde el UID físico de la tarjeta.</p>

          <form onSubmit={onRedeem} className={styles.formGrid}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <input
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit">Consumir saldo</button>
          </form>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Payload de referencia</h2>
          <pre className={styles.pre}>{JSON.stringify(card, null, 2)}</pre>
        </article>
      </div>

      <article className={styles.card}>
        <h2 className={styles.cardTitle}>Movimientos</h2>
        <div className={`${styles.tableWrap} ${styles.mt12}`}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Importe</th>
                <th>Descripción</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.type}</td>
                  <td>
                    {tx.amount} {card.currency}
                  </td>
                  <td>{tx.description ?? '-'}</td>
                  <td>{new Date(tx.created_at).toLocaleString('es-ES')}</td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={4}>Sin movimientos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
