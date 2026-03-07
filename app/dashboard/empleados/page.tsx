'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './page.module.css';

type PeriodMode = 'week' | 'month';

type Trabajador = {
  id: string;
  nombre_completo: string;
  numero_logico: number;
  activo: boolean;
  departamento?: string | null;
};

type Tarjeta = {
  id: string;
  uid_fisico: string;
  numero_logico: number;
  activa: boolean;
};

type Fichaje = {
  id: string;
  tipo: 'in' | 'out' | null;
  fichado_en: string;
  fecha_laboral: string;
  dispositivo_id: string | null;
};

function toInputDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function buildRange(anchor: Date, mode: PeriodMode) {
  if (mode === 'week') {
    const fromDate = startOfWeek(anchor);
    const toDate = endOfWeek(anchor);

    return {
      from: toInputDate(fromDate),
      to: toInputDate(toDate),
      label: `Semana del ${fromDate.toLocaleDateString('es-ES')} al ${toDate.toLocaleDateString('es-ES')}`,
    };
  }

  const fromDate = startOfMonth(anchor);
  const toDate = endOfMonth(anchor);

  return {
    from: toInputDate(fromDate),
    to: toInputDate(toDate),
    label: anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  };
}

function normalizeUid(value: string): string {
  return value.trim().toUpperCase();
}

export default function EmpleadosPage() {
  const today = useMemo(() => new Date(), []);

  const [workers, setWorkers] = useState<Trabajador[]>([]);
  const [workerCards, setWorkerCards] = useState<Tarjeta[]>([]);
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const [periodAnchor, setPeriodAnchor] = useState<string>(toInputDate(today));
  const [rangeLabel, setRangeLabel] = useState<string>('');

  const [fichajes, setFichajes] = useState<Fichaje[]>([]);

  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newCardUid, setNewCardUid] = useState('');

  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [newUidForSelected, setNewUidForSelected] = useState('');
  const [scannerMode, setScannerMode] = useState(false);
  const [scannerInput, setScannerInput] = useState('');
  const [pendingScannedUid, setPendingScannedUid] = useState<string | null>(null);
  const [scannerUiUid, setScannerUiUid] = useState<string | null>(null);
  const [scannerUiCardLabel, setScannerUiCardLabel] = useState<string | null>(null);
  const scannerRef = useRef<HTMLInputElement>(null);

  const [loadingWorkers, setLoadingWorkers] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [savingCreate, setSavingCreate] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [savingCards, setSavingCards] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((worker) => worker.nombre_completo.toLowerCase().includes(q));
  }, [workers, search]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [workers, selectedWorkerId],
  );

  const summary = useMemo(() => {
    const entradas = fichajes.filter((item) => item.tipo === 'in').length;
    const salidas = fichajes.filter((item) => item.tipo === 'out').length;
    return {
      total: fichajes.length,
      entradas,
      salidas,
      ultimo: fichajes[0]?.fichado_en ?? null,
    };
  }, [fichajes]);

  const dailyStats = useMemo(() => {
    const map = new Map<string, number>();

    for (const fichaje of fichajes) {
      map.set(fichaje.fecha_laboral, (map.get(fichaje.fecha_laboral) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [fichajes]);

  const maxDaily = useMemo(() => Math.max(...dailyStats.map((item) => item.total), 1), [dailyStats]);
  const nextWorkerNumber = useMemo(() => Math.max(...workers.map((worker) => worker.numero_logico || 0), 0) + 1, [workers]);

  const loadWorkers = useCallback(async (preferredWorkerId?: string) => {
    setLoadingWorkers(true);
    setErrorMsg(null);

    try {
      const withDepartment = await supabase
        .from('trabajadores')
        .select('id, nombre_completo, numero_logico, activo, departamento')
        .order('nombre_completo', { ascending: true });

      let list: Trabajador[] = [];

      if (!withDepartment.error) {
        list = (withDepartment.data ?? []) as Trabajador[];
      } else {
        const fallback = await supabase
          .from('trabajadores')
          .select('id, nombre_completo, numero_logico, activo')
          .order('nombre_completo', { ascending: true });

        if (fallback.error) {
          setErrorMsg(fallback.error.message);
          return;
        }

        list = ((fallback.data ?? []) as Omit<Trabajador, 'departamento'>[]).map((row) => ({
          ...row,
          departamento: null,
        }));
      }

      setWorkers(list);

      if (preferredWorkerId) {
        setSelectedWorkerId(preferredWorkerId);
      } else if (!selectedWorkerId && list.length > 0) {
        setSelectedWorkerId(list[0].id);
      }
    } finally {
      setLoadingWorkers(false);
    }
  }, [selectedWorkerId]);

  const loadWorkerCards = useCallback(async () => {
    if (!selectedWorkerId) {
      setWorkerCards([]);
      setCardDrafts({});
      return;
    }

    const { data, error } = await supabase
      .from('tarjetas')
      .select('id, uid_fisico, numero_logico, activa')
      .eq('trabajador_id', selectedWorkerId)
      .order('numero_logico', { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const cards = (data ?? []) as Tarjeta[];
    setWorkerCards(cards);
    setCardDrafts(Object.fromEntries(cards.map((card) => [card.id, card.uid_fisico])));
  }, [selectedWorkerId]);

  const loadWorkerDetail = useCallback(async () => {
    if (!selectedWorkerId) {
      setFichajes([]);
      return;
    }

    setLoadingDetail(true);
    setErrorMsg(null);

    const anchorDate = new Date(`${periodAnchor}T00:00:00`);
    if (Number.isNaN(anchorDate.getTime())) {
      setErrorMsg('Fecha base no válida.');
      setLoadingDetail(false);
      return;
    }

    const range = buildRange(anchorDate, periodMode);
    setRangeLabel(range.label);

    try {
      const { data, error } = await supabase
        .from('fichajes')
        .select('id, tipo, fichado_en, fecha_laboral, dispositivo_id')
        .eq('trabajador_id', selectedWorkerId)
        .gte('fecha_laboral', range.from)
        .lte('fecha_laboral', range.to)
        .order('fichado_en', { ascending: false });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setFichajes((data ?? []) as Fichaje[]);
    } finally {
      setLoadingDetail(false);
    }
  }, [periodMode, periodAnchor, selectedWorkerId]);

  const assignUidToWorker = useCallback(async (workerId: string, uidRaw: string) => {
    const uid = normalizeUid(uidRaw);
    if (!uid) return;

    const { data: existing, error: findError } = await supabase
      .from('tarjetas')
      .select('id, trabajador_id')
      .eq('uid_fisico', uid)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (existing?.trabajador_id && existing.trabajador_id !== workerId) {
      throw new Error('Ese UID ya está asignado a otro empleado.');
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('tarjetas')
        .update({ trabajador_id: workerId, activa: true })
        .eq('id', existing.id);

      if (updateError) throw new Error(updateError.message);
      return;
    }

    const { error: insertError } = await supabase
      .from('tarjetas')
      .insert({ uid_fisico: uid, trabajador_id: workerId, activa: true });

    if (insertError) throw new Error(insertError.message);
  }, []);

  const createWorker = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nombre = newName.trim();
    if (!nombre) return;

    setSavingCreate(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const payload: Record<string, unknown> = {
        nombre_completo: nombre,
        numero_logico: nextWorkerNumber,
        activo: true,
      };

      if (newDepartment.trim()) payload.departamento = newDepartment.trim();

      const { data, error } = await supabase.from('trabajadores').insert(payload).select('id').single();

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const workerId = (data as { id: string } | null)?.id;
      if (!workerId) {
        setErrorMsg('No se pudo obtener el empleado creado.');
        return;
      }

      if (newCardUid.trim()) {
        await assignUidToWorker(workerId, newCardUid);
      }

      setNewName('');
      setNewDepartment('');
      setNewCardUid('');
      setInfoMsg('Empleado creado correctamente.');
      await loadWorkers(workerId);
      await loadWorkerCards();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo crear el empleado.');
    } finally {
      setSavingCreate(false);
    }
  };

  const saveWorkerProfile = async () => {
    if (!selectedWorker) return;

    setSavingProfile(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const payload: Record<string, unknown> = {
      nombre_completo: editName.trim(),
    };

    payload.departamento = editDepartment.trim() || null;

    const { error } = await supabase.from('trabajadores').update(payload).eq('id', selectedWorker.id);

    if (error) {
      setErrorMsg(error.message);
      setSavingProfile(false);
      return;
    }

    setInfoMsg('Ficha del empleado actualizada.');
    await loadWorkers(selectedWorker.id);
    setSavingProfile(false);
  };

  const addCardToSelectedWorker = async () => {
    if (!selectedWorker || !newUidForSelected.trim()) return;

    setSavingCards(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await assignUidToWorker(selectedWorker.id, newUidForSelected);
      setNewUidForSelected('');
      setPendingScannedUid(null);
      setInfoMsg('Tarjeta asignada correctamente.');
      await loadWorkerCards();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo asignar la tarjeta.');
    } finally {
      setSavingCards(false);
    }
  };

  const saveCardUid = async (cardId: string) => {
    const uid = normalizeUid(cardDrafts[cardId] ?? '');
    if (!uid) return;

    setSavingCards(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase.from('tarjetas').update({ uid_fisico: uid }).eq('id', cardId);

    if (error) {
      setErrorMsg(error.message);
      setSavingCards(false);
      return;
    }

    setInfoMsg('UID de tarjeta actualizado.');
    await loadWorkerCards();
    setSavingCards(false);
  };

  const toggleCardActive = async (card: Tarjeta) => {
    setSavingCards(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase.from('tarjetas').update({ activa: !card.activa }).eq('id', card.id);

    if (error) {
      setErrorMsg(error.message);
      setSavingCards(false);
      return;
    }

    setInfoMsg(`Tarjeta ${card.activa ? 'desactivada' : 'activada'}.`);
    await loadWorkerCards();
    setSavingCards(false);
  };

  const toggleWorkerActive = async () => {
    if (!selectedWorker) return;

    setErrorMsg(null);

    const { error } = await supabase
      .from('trabajadores')
      .update({ activo: !selectedWorker.activo })
      .eq('id', selectedWorker.id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await loadWorkers(selectedWorker.id);
  };

  const processScannedUid = useCallback(
    async (uidRaw: string) => {
      const uid = normalizeUid(uidRaw);
      if (!uid) return;

      setErrorMsg(null);
      setInfoMsg(null);

      const { data: existing, error } = await supabase
        .from('tarjetas')
        .select('id, trabajador_id, uid_fisico, numero_logico')
        .eq('uid_fisico', uid)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (existing?.id) {
        const ownerName = workers.find((worker) => worker.id === existing.trabajador_id)?.nombre_completo;
        const logicalLabel =
          typeof existing.numero_logico === 'number' ? `Tarjeta #${existing.numero_logico}` : null;

        setScannerUiCardLabel(logicalLabel);
        if (existing.trabajador_id === selectedWorkerId) {
          setInfoMsg(
            logicalLabel
              ? `UID ${uid} (${logicalLabel}) ya está asignado a este empleado.`
              : `UID ${uid} ya está asignado a este empleado.`,
          );
        } else if (ownerName) {
          setInfoMsg(
            logicalLabel
              ? `UID ${uid} (${logicalLabel}) ya está asignado a ${ownerName}.`
              : `UID ${uid} ya está asignado a ${ownerName}.`,
          );
        } else {
          setInfoMsg(
            logicalLabel ? `UID ${uid} (${logicalLabel}) ya existe en el sistema.` : `UID ${uid} ya existe en el sistema.`,
          );
        }
        setPendingScannedUid(null);
        return;
      }

      setPendingScannedUid(uid);
      setNewUidForSelected(uid);

      if (!selectedWorker) {
        setInfoMsg(`Tarjeta nueva detectada (${uid}). Selecciona un empleado para asignarla.`);
        return;
      }

      setInfoMsg(`Tarjeta nueva detectada (${uid}). Lista para asignar a ${selectedWorker.nombre_completo}.`);
    },
    [selectedWorker, selectedWorkerId, workers],
  );

  const handleScannerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scannerMode) return;
    const uid = scannerInput.trim();
    if (!uid) return;
    setScannerUiUid(normalizeUid(uid));
    setScannerUiCardLabel(null);
    await processScannedUid(uid);
    setScannerInput('');
    scannerRef.current?.focus();
  };

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    void loadWorkerDetail();
    void loadWorkerCards();
  }, [loadWorkerDetail, loadWorkerCards]);

  useEffect(() => {
    if (!selectedWorker) {
      setEditName('');
      setEditDepartment('');
      return;
    }

    setEditName(selectedWorker.nombre_completo ?? '');
    setEditDepartment(selectedWorker.departamento ?? '');
  }, [selectedWorker]);

  useEffect(() => {
    if (!scannerMode) return;
    scannerRef.current?.focus();
    const timer = window.setInterval(() => {
      if (document.activeElement !== scannerRef.current) {
        scannerRef.current?.focus();
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [scannerMode]);

  return (
    <>
      <section className={styles.page}>
        <header className={styles.header}>
          <h1>Empleados</h1>
          <p>Alta y edición completa de empleados con configuración de tarjetas NFC desde la app.</p>
        </header>

      {errorMsg && <p className="status-error">{errorMsg}</p>}
      {infoMsg && <p className="status-ok">{infoMsg}</p>}

      <div className={styles.layout}>
        <article className={`${styles.card} ${styles.listCard}`}>
          <h2>Alta de empleado</h2>
          <p className={styles.helper}>Crea empleado y opcionalmente asigna una tarjeta NFC en el mismo paso.</p>

          <form className={styles.formGrid} onSubmit={createWorker}>
            <input
              placeholder="Nombre completo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              placeholder="Departamento (opcional)"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
            />
            <input
              placeholder="UID tarjeta NFC (opcional)"
              value={newCardUid}
              onChange={(e) => setNewCardUid(e.target.value)}
            />
            <button type="submit" disabled={savingCreate || newName.trim().length === 0}>
              {savingCreate ? 'Creando...' : 'Dar de alta'}
            </button>
          </form>

          <hr className={styles.separator} />

          <h2>Plantilla</h2>
          <p className={styles.helper}>Selecciona un empleado para editar su ficha y sus tarjetas.</p>

          <input
            placeholder="Buscar empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.search}
          />

          {loadingWorkers && <p className={styles.helper}>Cargando empleados...</p>}

          <div className={styles.workerList}>
            {filteredWorkers.map((worker) => (
              <button
                key={worker.id}
                type="button"
                className={`${styles.workerBtn} ${selectedWorkerId === worker.id ? styles.workerBtnActive : ''}`}
                onClick={() => setSelectedWorkerId(worker.id)}
              >
                <span className={styles.workerName}>{worker.nombre_completo}</span>
                <span className={`${styles.badge} ${worker.activo ? styles.badgeOk : styles.badgeMuted}`}>
                  {worker.activo ? 'Activo' : 'Inactivo'}
                </span>
              </button>
            ))}

            {!loadingWorkers && filteredWorkers.length === 0 && <p className={styles.helper}>No hay empleados para el filtro actual.</p>}
          </div>
        </article>

        <section className={styles.detailColumn}>
          <article className={`${styles.card} ${styles.detailCard}`}>
            <div className={styles.detailHead}>
              <div>
                <h2>{selectedWorker?.nombre_completo ?? 'Selecciona un empleado'}</h2>
                {selectedWorker && <p className={styles.helper}>Nº lógico: #{selectedWorker.numero_logico}</p>}
              </div>

              {selectedWorker && (
                <button type="button" onClick={toggleWorkerActive}>
                  {selectedWorker.activo ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>

            {selectedWorker && (
              <div className={styles.formGrid}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre completo" />
                <input
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  placeholder="Departamento"
                />
                <button type="button" onClick={saveWorkerProfile} disabled={savingProfile || editName.trim().length === 0}>
                  {savingProfile ? 'Guardando...' : 'Guardar ficha'}
                </button>
              </div>
            )}

            <div className={styles.controls}>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${periodMode === 'week' ? styles.segmentActive : ''}`}
                  onClick={() => setPeriodMode('week')}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${periodMode === 'month' ? styles.segmentActive : ''}`}
                  onClick={() => setPeriodMode('month')}
                >
                  Mes
                </button>
              </div>

              <label className={styles.dateField}>
                Fecha base
                <input type="date" value={periodAnchor} onChange={(e) => setPeriodAnchor(e.target.value)} />
              </label>

              <button type="button" onClick={() => void loadWorkerDetail()}>
                Actualizar
              </button>
            </div>

            <p className={styles.helper}>{rangeLabel}</p>

            <div className={styles.kpiGrid}>
              <article>
                <p className={styles.kpiLabel}>Fichajes</p>
                <p className={styles.kpiValue}>{summary.total}</p>
              </article>
              <article>
                <p className={styles.kpiLabel}>Entradas</p>
                <p className={styles.kpiValue}>{summary.entradas}</p>
              </article>
              <article>
                <p className={styles.kpiLabel}>Salidas</p>
                <p className={styles.kpiValue}>{summary.salidas}</p>
              </article>
              <article>
                <p className={styles.kpiLabel}>Último fichaje</p>
                <p className={styles.kpiValueSmall}>
                  {summary.ultimo ? new Date(summary.ultimo).toLocaleString('es-ES') : '-'}
                </p>
              </article>
            </div>
          </article>

          <article className={`${styles.card} ${styles.detailCard}`}>
            <h2>Tarjetas NFC del empleado</h2>
            <p className={styles.helper}>Configura UID, activa/desactiva y asigna nuevas tarjetas desde aquí.</p>

            <div className={styles.scanRow}>
              <button
                type="button"
                className={scannerMode ? styles.scanActiveBtn : ''}
                onClick={() => {
                  setScannerMode((prev) => !prev);
                  setPendingScannedUid(null);
                  setScannerInput('');
                  setScannerUiUid(null);
                  setScannerUiCardLabel(null);
                }}
              >
                {scannerMode ? 'Detener lectura' : 'Leer tarjeta nueva'}
              </button>
              {scannerMode && <span className={styles.scanStatus}>Modo lectura activo</span>}
            </div>

            {pendingScannedUid && (
              <p className={styles.helper}>
                UID pendiente detectado: <strong>{pendingScannedUid}</strong>
              </p>
            )}

            <div className={styles.formGrid}>
              <input
                placeholder="Nuevo UID para este empleado"
                value={newUidForSelected}
                onChange={(e) => setNewUidForSelected(e.target.value)}
                disabled={!selectedWorker}
              />
              <button
                type="button"
                onClick={addCardToSelectedWorker}
                disabled={!selectedWorker || savingCards || newUidForSelected.trim().length === 0}
              >
                {savingCards ? 'Guardando...' : 'Asignar tarjeta'}
              </button>
            </div>

            <div className={styles.cardList}>
              {workerCards.map((card) => (
                <article key={card.id} className={styles.cardItem}>
                  <div className={styles.cardItemHead}>
                    <strong>Tarjeta #{card.numero_logico}</strong>
                    <span className={`${styles.badge} ${card.activa ? styles.badgeOk : styles.badgeMuted}`}>
                      {card.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className={styles.cardItemActions}>
                    <input
                      value={cardDrafts[card.id] ?? ''}
                      onChange={(e) =>
                        setCardDrafts((prev) => ({
                          ...prev,
                          [card.id]: e.target.value,
                        }))
                      }
                      placeholder="UID físico"
                    />
                    <button type="button" onClick={() => void saveCardUid(card.id)} disabled={savingCards}>
                      Guardar UID
                    </button>
                    <button type="button" onClick={() => void toggleCardActive(card)} disabled={savingCards}>
                      {card.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              ))}

              {workerCards.length === 0 && <p className={styles.helper}>Este empleado no tiene tarjetas asignadas.</p>}
            </div>
          </article>

          <article className={`${styles.card} ${styles.chartCard}`}>
            <h2>Actividad por día</h2>
            <div className={styles.barList}>
              {dailyStats.map((item) => (
                <article key={item.fecha} className={styles.barItem}>
                  <div className={styles.barMeta}>
                    <span>{new Date(`${item.fecha}T00:00:00`).toLocaleDateString('es-ES')}</span>
                    <strong>{item.total}</strong>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(item.total / maxDaily) * 100}%` }} />
                  </div>
                </article>
              ))}
              {!loadingDetail && dailyStats.length === 0 && <p className={styles.helper}>Sin actividad en el periodo seleccionado.</p>}
            </div>
          </article>

          <article className={styles.card}>
            <h2>Últimos fichajes del empleado</h2>
            {loadingDetail && <p className={styles.helper}>Cargando detalle...</p>}

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo</th>
                    <th>Dispositivo</th>
                  </tr>
                </thead>
                <tbody>
                  {fichajes.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(`${item.fecha_laboral}T00:00:00`).toLocaleDateString('es-ES')}</td>
                      <td>
                        {new Date(item.fichado_en).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td>{item.tipo ?? '-'}</td>
                      <td>{item.dispositivo_id ?? '-'}</td>
                    </tr>
                  ))}
                  {!loadingDetail && fichajes.length === 0 && (
                    <tr>
                      <td colSpan={4}>Sin fichajes para este empleado en el periodo seleccionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
      </section>
      {scannerMode && (
        <div className={styles.scannerOverlay} role="dialog" aria-modal="true" aria-label="Lectura de tarjeta NFC">
          <div className={styles.scannerModal}>
            <button
              type="button"
              className={styles.scannerClose}
              onClick={() => {
                setScannerMode(false);
                setScannerInput('');
                setPendingScannedUid(null);
                setScannerUiUid(null);
                setScannerUiCardLabel(null);
              }}
            >
              Cerrar
            </button>

            <h2 className={styles.scannerTitle}>Leyendo tarjeta NFC</h2>
            <p className={styles.scannerSubtitle}>Acerca la tarjeta al lector USB. Se detectará automáticamente.</p>

            <div className={styles.scannerPulseWrap}>
              <div className={styles.scannerPulseCircle} />
              <div className={styles.scannerPulseCircle} />
              <div className={styles.scannerPulseCore} />
            </div>

            {scannerUiUid ? (
              <div className={styles.scannerDetected}>
                <p className={styles.scannerUid}>
                  UID detectado: <strong>{scannerUiUid}</strong>
                </p>
                {scannerUiCardLabel && (
                  <p className={styles.scannerMeta}>
                    Tipo:&nbsp;
                    <strong>{scannerUiCardLabel}</strong>
                  </p>
                )}
                {pendingScannedUid && (
                  <p className={styles.scannerMeta}>
                    Listo para asignar a este empleado. También verás el UID en el campo inferior.
                  </p>
                )}
              </div>
            ) : (
              <p className={styles.scannerHint}>Esperando lectura... No cierres esta ventana hasta terminar.</p>
            )}

            <form className={styles.scannerForm} onSubmit={handleScannerSubmit}>
              <label className={styles.scannerLabel}>
                Canal de lectura
                <input
                  ref={scannerRef}
                  placeholder="El lector escribirá aquí el UID y pulsará Enter"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  onBlur={() => scannerRef.current?.focus()}
                  autoComplete="off"
                  className={styles.scannerInput}
                />
              </label>
              <button type="submit" disabled={scannerInput.trim().length === 0}>
                Detectar UID manualmente
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
