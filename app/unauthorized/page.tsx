import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="stack-16" style={{ maxWidth: 760, margin: '40px auto' }}>
      <header>
        <h1 className="page-title">Acceso no autorizado</h1>
        <p className="page-subtitle">Tu usuario está autenticado, pero no tiene permisos owner para este panel.</p>
      </header>

      <article className="panel panel-muted">
        <p>Contacta con el owner principal para que te añada a la lista de acceso.</p>
        <p>
          <Link href="/login" className="inline-link">
            Volver a login
          </Link>
        </p>
      </article>
    </main>
  );
}
