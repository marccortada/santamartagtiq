'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import styles from './page.module.css';

const CODE_LENGTH = 6;

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';

  const [digits, setDigits] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function focusIndex(index: number) {
    const safeIndex = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    inputRefs.current[safeIndex]?.focus();
  }

  function handleDigitChange(index: number, rawValue: string) {
    const value = rawValue.toUpperCase().replace(/\s+/g, '');
    if (value.length === 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    const chars = value.split('');
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = chars[i];
      }
      return next;
    });

    const nextFocus = Math.min(index + chars.length, CODE_LENGTH - 1);
    focusIndex(nextFocus);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusIndex(index - 1);
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusIndex(index + 1);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const code = digits.join('').trim();
    if (code.length !== CODE_LENGTH) {
      setError(`Introduce los ${CODE_LENGTH} caracteres del codigo.`);
      setLoading(false);
      return;
    }

    const response = await fetch('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Codigo invalido');
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Santa Marta · Owner</p>
        <h1>Acceso por codigo</h1>
        <p className={styles.subtitle}>Introduce el codigo del owner para entrar al panel.</p>

        <form onSubmit={handleLogin} className={styles.form}>
          <label>
            Codigo de acceso (6 caracteres)
            <div className={styles.codeGrid}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputRefs.current[index] = node;
                  }}
                  type="password"
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handleDigitChange(index, e.clipboardData.getData('text'));
                  }}
                  required
                  autoFocus={index === 0}
                  className={styles.codeCell}
                />
              ))}
            </div>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {error && <p className="status-error">{error}</p>}
      </section>
    </main>
  );
}
