'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

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
    if (!id) return;
    setLoading(true);
    setError(null);

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
      setLoading(false);
      return;
    }
    if (txError) {
      setError(txError.message);
      setLoading(false);
      return;
    }

    setCard(cardData as GiftCard);
    setTxs((txData ?? []) as GiftCardTx[]);
    setLoading(false);
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
      p_description: description || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (!data?.success) {
      setError(data?.error_message ?? 'No se pudo registrar el consumo');
      return;
    }

    setInfo(`Consumo registrado. Nuevo saldo: ${data.new_balance} ${card.currency}`);
    setAmount('0.00');
    setDescription('');
    await loadDetail();
  };

  if (loading) return <p>Cargando detalle...</p>;
  if (!card) return <p>No se encontró la tarjeta.</p>;

  return (
    <section>
      <h2>Detalle Gift Card</h2>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {info && <p style={{ color: 'green' }}>{info}</p>}

      <div style={{ marginBottom: 16 }}>
        <p>
          <strong>Label:</strong> {card.label}
        </p>
        <p>
          <strong>UID:</strong> {card.nfc_uid}
        </p>
        <p>
          <strong>Inicial:</strong> {card.initial_amount} {card.currency}
        </p>
        <p>
          <strong>Saldo actual:</strong> {card.current_balance} {card.currency}
        </p>
        <p>
          <strong>Activa:</strong> {card.is_active ? 'Sí' : 'No'}
        </p>
        <p>
          <strong>Caduca:</strong> {card.expires_at ? new Date(card.expires_at).toLocaleString('es-ES') : '-'}
        </p>
      </div>

      <form onSubmit={onRedeem} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 420 }}>
        <h3>Registrar consumo (RPC)</h3>
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

      <h3>Movimientos</h3>
      <table cellPadding={8} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Tipo</th>
            <th align="left">Importe</th>
            <th align="left">Descripción</th>
            <th align="left">Fecha</th>
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
    </section>
  );
}
