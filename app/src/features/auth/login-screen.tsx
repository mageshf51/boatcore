'use client';
import { useState } from 'react';
import { OceanScene } from './ocean-scene';
import styles from './ocean-scene.module.css';
import { Anchor, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api-client';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { useT } from '../../lib/translations';
import { usePreferences } from '../../stores/preferences-store';
export function LoginScreen() {
  const [pin, setPin] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    { refresh } = useWorkspace(),
    t = useT(),
    { language, setLanguage } = usePreferences();
  async function login(guest = false) {
    setBusy(true);
    setError('');
    try {
      await api(guest ? '/auth/guest' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      setPin('');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`login-scene ${styles.page}`}>
      <OceanScene />
      <div className="login-top">
        <span className="brand">
          <Anchor /> boatcore.
        </span>
        <button
          className="language-switch"
          onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
        >
          {language === 'en' ? 'தமிழ்' : 'English'}
        </button>
      </div>
      <section className="login-panel">
        <div className="login-emblem">
          <Anchor size={30} />
        </div>
        <span className="eyebrow">YOUR BOAT. ONE WORKSPACE.</span>
        <h1>{t('Connected operations')}</h1>
        <p>{t('Four digits. Your own workspace.')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label className="field">
            <span>{t('Enter your PIN')}</span>
            <input
              autoComplete="off"
              autoFocus
              aria-label={t('Enter your PIN')}
              className="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy || pin.length !== 4}>
            {busy ? '…' : t('Sign in')}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="login-divider">
          <span>PORTFOLIO REVIEW</span>
        </div>
        <button className="button secondary full" disabled={busy} onClick={() => void login(true)}>
          <ShieldCheck size={17} />
          {t('Review as Guest')}
        </button>
        <small className="login-foot">BoatCore · Built for the people behind every voyage.</small>
      </section>
      <div className="login-bottom">A clearer view of every voyage.</div>
    </main>
  );
}
