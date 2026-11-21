'use client';
import { useState } from 'react';
import { Search, History, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { useT } from '../../lib/translations';
import type { Audit } from '../../../../shared/models';
export function AuditTable({ events }: { events: Audit[] }) {
  const t = useT(),
    [open, setOpen] = useState('');
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {['Time', 'User', 'Action', 'Record', 'Details'].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...events].reverse().map((e) => (
            <tr key={e.id}>
              <td>
                <span className="nowrap">
                  {new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </td>
              <td>
                <span className="user-chip">
                  <span className="mini-avatar">{e.actor[0]}</span>
                  {e.actor}
                </span>
              </td>
              <td>
                <span className="badge">{e.action}</span>
              </td>
              <td>
                {e.kind}
                <small className="row-subtitle">
                  {e.after?.name || e.after?.buyer || e.recordId.slice(0, 8)}
                </small>
              </td>
              <td>
                <button className="text-button" onClick={() => setOpen(open === e.id ? '' : e.id)}>
                  {t('View')}
                  <ChevronDown size={14} />
                </button>
                {open === e.id && (
                  <div className="audit-diff">
                    <strong>{t('Before')}</strong>
                    <pre>{JSON.stringify(e.before, null, 2)}</pre>
                    <strong>{t('After')}</strong>
                    <pre>{JSON.stringify(e.after, null, 2)}</pre>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!events.length && (
            <tr>
              <td colSpan={5} className="empty">
                {t('No changes recorded')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function HistoryPage() {
  const { data } = useWorkspace(),
    t = useT(),
    [query, setQuery] = useState(''),
    [actor, setActor] = useState('all');
  if (!data) return null;
  return (
    <>
      <PageHeader eyebrow="ACCOUNTABILITY" title="Change History" description="Who changed what" />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label={t('Search records')}
              placeholder={t('Search records')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select aria-label={t('User')} value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">{t('All')}</option>
            {data.team.map((u) => (
              <option value={u.id} key={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <AuditTable
          events={data.audit.filter(
            (a) =>
              (actor === 'all' || a.userId === actor) &&
              JSON.stringify(a).toLowerCase().includes(query.toLowerCase()),
          )}
        />
      </section>
    </>
  );
}
