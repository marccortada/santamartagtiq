import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Santa Marta</h1>
      <p>
        <Link href="/test">Ir a /test</Link>
      </p>
      <p>
        <Link href="/dashboard/fichajes">Ir a /dashboard/fichajes</Link>
      </p>
    </main>
  );
}

