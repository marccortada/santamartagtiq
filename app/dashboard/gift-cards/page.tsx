"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  created_at: string;
};

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [initialAmount, setInitialAmount] = useState('100.00');
  const [expiresAt, setExpiresAt] = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [birthdayNote, setBirthdayNote] = useState('');
  const [dniNote, setDniNote] = useState('');
  const [phoneNote, setPhoneNote] = useState('');
  const [search, setSearch] = useState('');
  const [adjustValues, setAdjustValues] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadGiftCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('gift_cards')
        .select('id, label, initial_amount, current_balance, currency, is_active, expires_at, created_at')
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

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((card) => card.label.toLowerCase().includes(term));
  }, [cards, search]);

  const onCreateCard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsedAmount = Number(initialAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('El importe inicial debe ser mayor que 0');
      return;
    }

    const generatedUid = `GC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const extraNoteParts: string[] = [];
    if (birthdayNote.trim()) extraNoteParts.push(`CUMPLE: ${birthdayNote.trim()}`);
    if (dniNote.trim()) extraNoteParts.push(`DNI: ${dniNote.trim()}`);
    if (phoneNote.trim()) extraNoteParts.push(`TEL: ${phoneNote.trim()}`);
    const extraNote = extraNoteParts.join(' · ');

    const payload: Record<string, unknown> = {
      // Guardamos siempre el nombre en mayúsculas
      label: label.trim().toUpperCase(),
      // UID interno para mantener compatibilidad con el esquema actual (no se muestra en la UI)
      nfc_uid: generatedUid,
      initial_amount: parsedAmount,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (extraNote) {
      // Si tu tabla gift_cards ya tiene un campo "notes" o similar, esto lo rellenará.
      // Si no existe, puedes añadirlo en Supabase (texto opcional).
      payload.notes = extraNote;
    }

    const { error: insertError } = await supabase.from('gift_cards').insert(payload);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setInfo('Tarjeta regalo creada');
    setLabel('');
    setInitialAmount('100.00');
    setExpiresAt('');
    setBirthdayNote('');
    setDniNote('');
    setPhoneNote('');
    await loadGiftCards();
  };

  const handleAdjustChange = (id: string, value: string) => {
    setAdjustValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleAdjust = async (id: string, mode: 'add' | 'subtract') => {
    const raw = (adjustValues[id] ?? '').trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('El importe debe ser mayor que 0');
      return;
    }

    setError(null);
    setInfo(null);
    setUpdatingId(id);

    try {
      if (mode === 'subtract') {
        const { data, error: rpcError } = await supabase.rpc('redeem_gift_card_by_id', {
          p_gift_card_id: id,
          p_amount: parsed,
          p_description: 'Ajuste manual (restar) desde listado',
        });

        if (rpcError) {
          setError(rpcError.message);
          return;
        }

        const result = (data ?? null) as { success?: boolean; error_message?: string; new_balance?: number } | null;
        if (!result?.success) {
          setError(result?.error_message ?? 'No se pudo restar saldo a la tarjeta.');
          return;
        }

        setInfo(
          typeof result.new_balance === 'number'
            ? `Saldo actualizado. Nuevo saldo: ${result.new_balance.toFixed(2)}`
            : 'Saldo actualizado.',
        );
      } else {
        const { data, error: rpcError } = await supabase.rpc('top_up_gift_card_by_id', {
          p_gift_card_id: id,
          p_amount: parsed,
          p_description: 'Ajuste manual (sumar) desde listado',
        });

        if (rpcError) {
          setError(rpcError.message);
          return;
        }

        const result = (data ?? null) as { success?: boolean; error_message?: string; new_balance?: number } | null;
        if (!result?.success) {
          setError(result?.error_message ?? 'No se pudo añadir saldo a la tarjeta.');
          return;
        }

        setInfo(
          typeof result.new_balance === 'number'
            ? `Saldo actualizado. Nuevo saldo: ${result.new_balance.toFixed(2)}`
            : 'Saldo actualizado.',
        );
      }

      setAdjustValues((prev) => ({
        ...prev,
        [id]: '',
      }));
      await loadGiftCards();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setError(null);
    setInfo(null);
    setUpdatingId(id);

    try {
      const { data, error: rpcError } = await supabase.rpc('complete_gift_card_by_id', {
        p_gift_card_id: id,
        p_description: 'Completar tarjeta desde listado',
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const result = (data ?? null) as { success?: boolean; error_message?: string } | null;
      if (!result?.success) {
        setError(result?.error_message ?? 'No se pudo completar la tarjeta.');
        return;
      }

      setInfo('Tarjeta completada. Saldo puesto a cero y marcada como inactiva.');
      await loadGiftCards();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Tarjetas regalo</h1>
        <p>Gestión de tarjetas regalo: alta, saldo actual y acceso al detalle de movimientos.</p>
      </header>

      <article className={`${styles.card} ${styles.cardPink}`}>
        <h2 className={styles.cardTitle}>Nueva tarjeta regalo</h2>
        <p className={styles.cardText}>Crea una tarjeta indicando el nombre de la persona e importe inicial.</p>

        <form onSubmit={onCreateCard} className={styles.formGrid}>
          <input
            placeholder="Nombre de la persona (MAYÚSCULAS)"
            value={label}
            onChange={(e) => setLabel(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase' }}
            required
          />
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

          <div className={styles.accordion}>
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={() => setShowExtra((prev) => !prev)}
            >
              <span>Datos opcionales del vale (cumpleaños, DNI, teléfono…)</span>
              <span className={styles.accordionChevron}>{showExtra ? '▴' : '▾'}</span>
            </button>
            {showExtra && (
              <div className={styles.accordionBody}>
                <div>
                  <div className={styles.accordionLabel}>Fecha de cumpleaños (texto libre)</div>
                  <input
                    placeholder="Ej: 12/03 o 12 marzo"
                    value={birthdayNote}
                    onChange={(e) => setBirthdayNote(e.target.value)}
                  />
                </div>
                <div>
                  <div className={styles.accordionLabel}>DNI / NIF</div>
                  <input
                    placeholder="Ej: 12345678A"
                    value={dniNote}
                    onChange={(e) => setDniNote(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <div className={styles.accordionLabel}>Teléfono</div>
                  <input
                    placeholder="Ej: 600 123 456"
                    value={phoneNote}
                    onChange={(e) => setPhoneNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <button type="submit">Crear tarjeta</button>
        </form>
      </article>

      {loading && <p className={styles.muted}>Cargando tarjetas...</p>}
      {error && <p className="status-error">{error}</p>}
      {info && <p className="status-ok">{info}</p>}

      <div className={`${styles.row} ${styles.mt12}`}>
        <input
          className={styles.grow}
          placeholder="Buscar tarjeta por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          style={{ textTransform: 'uppercase' }}
        />
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Inicial</th>
              <th>Saldo</th>
              <th>Activa</th>
              <th>Caduca</th>
              <th>Detalle</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCards.map((card) => (
              <tr key={card.id}>
                <td>{card.label}</td>
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
                <td>
                  <div className={styles.actions}>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Importe"
                      value={adjustValues[card.id] ?? ''}
                      onChange={(e) => handleAdjustChange(card.id, e.target.value)}
                      style={{ maxWidth: 90 }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAdjust(card.id, 'subtract')}
                      disabled={updatingId === card.id}
                    >
                      Restar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAdjust(card.id, 'add')}
                      disabled={updatingId === card.id}
                    >
                      Sumar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleComplete(card.id)}
                      disabled={updatingId === card.id || card.current_balance <= 0}
                    >
                      Completar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredCards.length === 0 && (
              <tr>
                <td colSpan={7}>No hay tarjetas regalo para ese filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
