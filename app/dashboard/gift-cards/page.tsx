'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

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

    const { data, error: queryError } = await supabase
      .from('gift_cards')
      .select('id, label, nfc_uid, initial_amount, current_balance, currency, is_active, expires_at, created_at')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setCards((data ?? []) as GiftCard[]);
    setLoading(false);
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
    <section>
      <h2>Gift Cards</h2>

      <form onSubmit={onCreateCard} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <h3>Nueva tarjeta regalo</h3>
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

      {loading && <p>Cargando tarjetas...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {info && <p style={{ color: 'green' }}>{info}</p>}

      <table cellPadding={8} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Label</th>
            <th align="left">UID</th>
            <th align="left">Inicial</th>
            <th align="left">Saldo</th>
            <th align="left">Activa</th>
            <th align="left">Caduca</th>
            <th align="left">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id}>
              <td>{c.label}</td>
              <td>{c.nfc_uid}</td>
              <td>
                {c.initial_amount} {c.currency}
              </td>
              <td>
                {c.current_balance} {c.currency}
              </td>
              <td>{c.is_active ? 'Sí' : 'No'}</td>
              <td>{c.expires_at ? new Date(c.expires_at).toLocaleString('es-ES') : '-'}</td>
              <td>
                <Link href={`/dashboard/gift-cards/${c.id}`}>Abrir</Link>
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
    </section>
  );
}
