'use client';

import { useState } from 'react';
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

    const { data, error: rpcError } = await supabase.rpc('get_gift_card_by_uid', {
      p_nfc_uid: uid,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const normalized = Array.isArray(data) ? data[0] : data;
    setCard((normalized as GiftCard) ?? null);
    setLoading(false);
  };

  return (
    <section>
      <h2>Lookup Gift Card por UID</h2>

      <form onSubmit={onLookup} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="UID NFC"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          required
          style={{ minWidth: 280 }}
        />
        <button type="submit">Buscar</button>
      </form>

      {loading && <p>Buscando...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {card && (
        <div>
          <p>
            <strong>Label:</strong> {card.label}
          </p>
          <p>
            <strong>UID:</strong> {card.nfc_uid}
          </p>
          <p>
            <strong>Saldo:</strong> {card.current_balance} {card.currency}
          </p>
          <p>
            <strong>Inicial:</strong> {card.initial_amount} {card.currency}
          </p>
          <p>
            <strong>Activa:</strong> {card.is_active ? 'Sí' : 'No'}
          </p>
          <p>
            <strong>Caduca:</strong> {card.expires_at ? new Date(card.expires_at).toLocaleString('es-ES') : '-'}
          </p>
        </div>
      )}
    </section>
  );
}
