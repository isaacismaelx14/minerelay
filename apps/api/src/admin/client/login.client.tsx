import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { readError } from './http';

type LoginStatus = {
  text: string;
  tone: 'idle' | 'ok' | 'error';
};

function statusClass(tone: LoginStatus['tone']): string {
  if (tone === 'ok') return 'status ok';
  if (tone === 'error') return 'status error';
  return 'status';
}

function LoginApp(): ReactElement {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>({
    text: 'Ready.',
    tone: 'idle',
  });
  const disabled = useMemo(() => password.trim().length === 0, [password]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = password.trim();
    if (!trimmed) {
      setStatus({ text: 'Enter password first.', tone: 'error' });
      return;
    }

    setStatus({ text: 'Signing in...', tone: 'idle' });

    try {
      const response = await fetch('/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: trimmed }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Invalid password.'));
      }

      setStatus({ text: 'Signed in.', tone: 'ok' });
      window.location.href = '/admin';
    } catch (error) {
      setStatus({
        text: (error as Error).message || 'Login failed.',
        tone: 'error',
      });
    }
  };

  return (
    <main className="login-shell">
      <h1>MSS+ Client Control Console</h1>
      <p>Enter your admin password to unlock server publishing controls.</p>

      <form onSubmit={(event) => void onSubmit(event)}>
        <label>
          Password
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Admin password"
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>

        <button id="loginBtn" type="submit" disabled={disabled}>
          Sign In
        </button>
      </form>

      <div id="loginStatus" className={statusClass(status.tone)}>
        {status.text}
      </div>
    </main>
  );
}

function mount(): void {
  const rootElement = document.getElementById('admin-login-root');
  if (!rootElement) {
    throw new Error('Missing admin login root element');
  }

  createRoot(rootElement).render(<LoginApp />);
}

mount();
