'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/app/_styles/ops.module.css';

type Trabajador = {
  id: string;
  nombre_completo: string;
};

export default function TestPage() {
  const [rows, setRows] = useState<Trabajador[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('trabajadores')
        .select('id, nombre_completo')
        .order('nombre_completo', { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setRows(data as Trabajador[]);
      }
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Test de conexión</h1>
        <p>Lectura básica de trabajadores desde Supabase para validar conectividad.</p>
      </header>

      {loading && <p className={styles.muted}>Cargando...</p>}
      {errorMsg && <p className="status-error">Error: {errorMsg}</p>}

      {!loading && !errorMsg && (
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Trabajadores</h2>
          <div className={`${styles.tableWrap} ${styles.mt12}`}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((worker) => (
                  <tr key={worker.id}>
                    <td>{worker.id}</td>
                    <td>{worker.nombre_completo}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={2}>Sin trabajadores disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  );
}
