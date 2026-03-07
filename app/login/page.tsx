import { Suspense } from 'react';
import LoginClient from './login-client';

function LoginFallback() {
  return (
    <main className="panel stack-16 max-720" style={{ margin: '40px auto' }}>
      <p className="m-0">Cargando login...</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
