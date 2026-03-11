'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Trabajador = {
  id: string;
  nombre_completo: string;
};

export default function TestPage() {
  const [rows, setRows] = useState<Trabajador[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    }

    load();
  }, []);

  if (errorMsg) {
    return <p>Error: {errorMsg}</p>;
  }

  return (
    <div>
      <h1>Trabajadores</h1>
      <ul>
        {rows.map((t) => (
          <li key={t.id}>{t.nombre_completo}</li>
        ))}
      </ul>
    </div>
  );
}
