'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { failure } from '../../components/ui/action-feedback';
import { api } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function TeamChatPage() {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(
    () => end.current?.scrollIntoView({ block: 'nearest' }),
    [data?.entities.messages.length],
  );
  if (!data) return null;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api('/records/messages', { method: 'POST', body: JSON.stringify({ text }) });
      setText('');
      await refresh();
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="STAY CONNECTED" title="Team Chat" description="Team workspace" />
      <div className="chat-layout">
        <section className="panel chat-panel">
          <div className="chat-heading">
            <span className="module-icon">
              <MessageCircle size={21} />
            </span>
            <div>
              <strong>BoatCore {t('Team workspace')}</strong>
              <small>
                {data.team.length} {t('Team members')}
              </small>
            </div>
            <span className="badge active">15s sync</span>
          </div>
          <div className="messages">
            {data.entities.messages.map((m) => (
              <div key={m.id} className={`message ${m.userId === data.user.id ? 'own' : ''}`}>
                <span className="mini-avatar">{m.author?.[0]}</span>
                <div>
                  <div className="message-meta">
                    <strong>{m.author}</strong>
                    <time>
                      {new Date(m.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <p>{m.text}</p>
                </div>
              </div>
            ))}
            {!data.entities.messages.length && <div className="empty">{t('No records yet')}</div>}
            <div ref={end} />
          </div>
          {data.user.role !== 'guest' ? (
            <form className="chat-composer" onSubmit={send}>
              <input
                aria-label={t('Message your team…')}
                placeholder={t('Message your team…')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
              />
              <button className="button" aria-label={t('Send')} disabled={busy || !text.trim()}>
                <Send size={17} />
                <span>{t('Send')}</span>
              </button>
            </form>
          ) : (
            <div className="read-only-note">{t('Guest access is read only')}</div>
          )}
        </section>
        <aside className="panel team-panel">
          <h3>{t('Team members')}</h3>
          {data.team.map((u) => (
            <div className="team-member" key={u.id}>
              <span className="avatar">{u.name[0]}</span>
              <div>
                <strong>{u.name}</strong>
                <small>{u.role}</small>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
