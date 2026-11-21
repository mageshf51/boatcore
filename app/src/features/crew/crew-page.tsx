'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, AlertTriangle, Wallet, Users, Pencil } from 'lucide-react';
import { Decimal } from 'decimal.js';
import Swal from 'sweetalert2';
import type { Entity } from '../../../../shared/models';
import type { CrewSalary } from '../../../../shared/crew-ledger';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { Field } from '../../components/ui/form-controls';
import { RecordModal } from '../../components/ui/record-modal';
import { confirmAction, failure, success } from '../../components/ui/action-feedback';
import { api, inr, today } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function CrewPage() {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [tab, setTab] = useState('Pending salaries'),
    [crewId, setCrewId] = useState(''),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState<'advance' | 'wage' | null>(null),
    [edit, setEdit] = useState<Entity | undefined>(),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setCrewId(new URLSearchParams(window.location.search).get('person') || '');
  }, []);
  if (!data) return null;
  const writable = data.user.role !== 'guest',
    ledger = data.crewLedger;
  if (!data.settings.fieldVisibility[data.user.role].some((v) => v === '*' || v === 'finance'))
    return <p>{t('Finance access required')}</p>;
  const selected = ledger.crew.filter((c) => !crewId || c.crewId === crewId);
  const match = (name: string, id: string) =>
    name.toLowerCase().includes(query.toLowerCase()) && (!crewId || id === crewId);
  const pending = ledger.pending.filter((p) => match(p.name, p.crewId));
  async function pay(row: CrewSalary) {
    if (busy) return;
    setBusy(true);
    try {
      const excess = Number(row.overdue) > 0;
      const result = await Swal.fire({
        title: t(excess ? 'Advance exceeds salary' : 'Pay salary?'),
        text: `${row.name} · ${row.trip}\n${t('Salary')}: ${inr(row.salary)} · ${t('Outstanding advance')}: ${inr(row.advance)}\n${t('Balance to pay')}: ${inr(row.balance)} · ${t('Excess advance')}: ${inr(row.overdue)}${excess ? '\n' + t('Pay full salary anyway leaves the advance outstanding.') : ''}`,
        icon: excess ? 'warning' : 'question',
        showCancelButton: true,
        showDenyButton: excess,
        confirmButtonText: t(excess ? 'Settle against advance' : 'Confirm payment'),
        denyButtonText: t('Pay full salary anyway'),
        cancelButtonText: t('Cancel'),
        confirmButtonColor: '#242625',
        denyButtonColor: '#b76b3d',
      });
      if (!result.isConfirmed && !result.isDenied) return;
      await api('/crew/pay', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          crewId: row.crewId,
          revision: row.revision,
          date: today(),
          mode: result.isDenied ? 'full' : 'net',
          confirmExcess: excess,
          notes: '',
        }),
      });
      await refresh();
      await success(t('Paid'));
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="CREW ACCOUNTS"
        title="Crew"
        description="Pending salaries and advances across all trips"
        action={
          writable ? (
            <div className="button-row wrap">
              <button
                className="button secondary"
                onClick={() => {
                  setEdit(undefined);
                  setModal('advance');
                }}
              >
                <Plus size={16} />
                {t('Add advance')}
              </button>
              <button
                className="button"
                onClick={() => {
                  setEdit(undefined);
                  setModal('wage');
                }}
              >
                <Plus size={16} />
                {t('Add wages')}
              </button>
            </div>
          ) : undefined
        }
      />
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">{t('Pending salaries')}</div>
          <strong>
            {inr(selected.reduce((n, c) => n.plus(c.pendingSalary), new Decimal(0)).toString())}
          </strong>
        </div>
        <div className="metric-card">
          <div className="metric-top">{t('Outstanding advance')}</div>
          <strong>
            {inr(selected.reduce((n, c) => n.plus(c.advance), new Decimal(0)).toString())}
          </strong>
        </div>
        <div className="metric-card">
          <div className="metric-top">{t('Unpaid salary count')}</div>
          <strong>{selected.reduce((n, c) => n + c.pendingCount, 0)}</strong>
        </div>
      </div>
      <div className="tabs">
        {['Pending salaries', 'Advances', 'Land wages', 'Payment history'].map((label) => (
          <button
            key={label}
            className={tab === label ? 'selected' : ''}
            onClick={() => setTab(label)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label={t('Search crew')}
              value={query}
              placeholder={t('Search crew')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label={t('Choose crew')}
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
          >
            <option value="">{t('All crew')}</option>
            {data.entities.crew.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {tab === 'Pending salaries' && (
          <>
            <div className="notice">
              {t(
                'Advances are applied oldest salary first. Final trip shares can be paid after completing the trip. Draft shares do not reserve advances.',
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      'S.No.',
                      'Name',
                      'Trip / work',
                      'Salary',
                      'Advance',
                      'Balance to pay',
                      'Excess advance',
                      'Actions',
                    ].map((h) => (
                      <th key={h}>{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((row, i) => (
                    <tr key={row.key}>
                      <td>{i + 1}</td>
                      <td className="strong">{row.name}</td>
                      <td>
                        {row.tripId ? (
                          <Link href={`/trip-details/${row.tripId}`}>{row.trip}</Link>
                        ) : (
                          row.trip
                        )}
                        <small className="row-subtitle">
                          {row.date} · {t(row.sourceType === 'trip' ? 'Crew shares' : 'Land wages')}
                          {!row.ready ? ` · ${t('Draft')}` : ''}
                        </small>
                      </td>
                      <td className="number">{inr(row.salary)}</td>
                      <td className={Number(row.overdue) > 0 ? 'danger-text' : 'number'}>
                        {Number(row.overdue) > 0 && <AlertTriangle size={13} />} {inr(row.advance)}
                      </td>
                      <td className="number">{inr(row.balance)}</td>
                      <td className={Number(row.overdue) > 0 ? 'danger-text' : 'number'}>
                        {inr(row.overdue)}
                      </td>
                      <td>
                        {writable && (
                          <button
                            className="button small"
                            disabled={busy || !row.ready || !row.isFirst}
                            title={
                              !row.ready
                                ? t('Complete the trip first')
                                : !row.isFirst
                                  ? t('Pay earlier salary first')
                                  : t('Pay')
                            }
                            onClick={() => void pay(row)}
                          >
                            {t('Pay')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!pending.length && (
                    <tr>
                      <td colSpan={8} className="empty">
                        {t('No records yet')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'Advances' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Name', 'Date', 'Advance', 'Notes', 'Recorded by'].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.entities.advances]
                  .reverse()
                  .filter((a) =>
                    match(data.entities.crew.find((c) => c.id === a.crewId)?.name || '', a.crewId),
                  )
                  .map((a) => (
                    <tr key={a.id}>
                      <td>{data.entities.crew.find((c) => c.id === a.crewId)?.name}</td>
                      <td>{a.date}</td>
                      <td>{inr(a.amount)}</td>
                      <td>{a.notes}</td>
                      <td>{a.actor}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="notice">
              {t('Outstanding advance')}:{' '}
              {inr(selected.reduce((n, c) => n.plus(c.advance), new Decimal(0)).toString())}
            </div>
          </div>
        )}
        {tab === 'Land wages' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Date', 'Crew', 'Total amount', 'Notes', 'Actions'].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.entities.wages]
                  .reverse()
                  .filter((w) =>
                    w.members.some((m: any) =>
                      match(
                        data.entities.crew.find((c) => c.id === m.crewId)?.name || '',
                        m.crewId,
                      ),
                    ),
                  )
                  .map((w) => (
                    <tr key={w.id}>
                      <td>{w.date}</td>
                      <td>
                        {w.members.map((m: any) => {
                          const row = ledger.pending.find(
                            (p) =>
                              p.sourceType === 'wage' &&
                              p.sourceId === w.id &&
                              p.crewId === m.crewId,
                          );
                          const isPaid = ledger.payments.some(
                            (p) =>
                              p.sourceType === 'wage' &&
                              p.sourceId === w.id &&
                              p.crewId === m.crewId,
                          );
                          return (
                            <div className="payment-line" key={m.crewId}>
                              {m.name} · {inr(m.amount)}{' '}
                              <span className={`badge ${isPaid ? 'paid' : 'pending'}`}>
                                {t(isPaid ? 'Paid' : 'Pending')}
                              </span>
                              {writable && row && (
                                <button
                                  className="text-button"
                                  disabled={busy || !row.isFirst}
                                  title={!row.isFirst ? t('Pay earlier salary first') : t('Pay')}
                                  onClick={() => void pay(row)}
                                >
                                  {t('Pay')}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td>{inr(w.amount)}</td>
                      <td>{w.notes}</td>
                      <td>
                        <div className="row-actions">
                          {writable && (
                            <button
                              className="icon-button"
                              aria-label={t('Edit')}
                              onClick={() => {
                                setEdit(w);
                                setModal('wage');
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {writable && (
                            <button
                              className="text-button"
                              onClick={() => setTab('Pending salaries')}
                            >
                              {t('Pay')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="notice">
              {t(
                'Land wages reduce owner profit once when recorded. Paying them does not deduct profit again.',
              )}
            </div>
          </div>
        )}
        {tab === 'Payment history' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    'Name',
                    'Trip / work',
                    'Date',
                    'Salary',
                    'Advance recovered',
                    'Paid amount',
                    'Outstanding advance',
                    'Recorded by',
                  ].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ledger.payments]
                  .reverse()
                  .filter((p) => match(p.name, p.crewId))
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.name}
                        <small className="badge paid">{t('Paid')}</small>
                      </td>
                      <td>{p.sourceLabel}</td>
                      <td>{p.date}</td>
                      <td>{inr(p.salary)}</td>
                      <td>{inr(p.appliedAdvance)}</td>
                      <td>{inr(p.amount)}</td>
                      <td>{inr(p.advanceAfter)}</td>
                      <td>{p.actor}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal === 'advance' && <AdvanceForm initialCrewId={crewId} onClose={() => setModal(null)} />}{' '}
      {modal === 'wage' && <WageForm existing={edit} onClose={() => setModal(null)} />}
    </>
  );
}
function AdvanceForm({ initialCrewId, onClose }: { initialCrewId: string; onClose: () => void }) {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [form, setForm] = useState({ crewId: initialCrewId, date: today(), amount: '', notes: '' }),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  return (
    <RecordModal title="Add advance" onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            if (!(await confirmAction(t('Save changes?')))) return;
            await api('/crew/advances', { method: 'POST', body: JSON.stringify(form) });
            await refresh();
            onClose();
            await success(t('Saved successfully'));
          } catch (e: any) {
            await failure(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Choose crew">
            <select
              required
              value={form.crewId}
              onChange={(e) => setForm({ ...form, crewId: e.target.value })}
            >
              <option value="">{t('Choose crew')}</option>
              {data.entities.crew
                .filter((c) => c.active)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <div className="form-wide">
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button className="button" disabled={busy}>
            {t('Save')}
          </button>
        </div>
      </form>
    </RecordModal>
  );
}
function WageForm({ existing, onClose }: { existing?: Entity; onClose: () => void }) {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [date, setDate] = useState(existing?.date || today()),
    [notes, setNotes] = useState(existing?.notes || ''),
    [query, setQuery] = useState(''),
    [uniform, setUniform] = useState('300'),
    [members, setMembers] = useState<Record<string, string>>(
      Object.fromEntries((existing?.members || []).map((m: any) => [m.crewId, m.amount])),
    ),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  const paid = (id: string) =>
    Boolean(
      existing &&
      data.crewLedger.payments.some(
        (p) => p.sourceType === 'wage' && p.sourceId === existing.id && p.crewId === id,
      ),
    );
  const crew = data.entities.crew
      .filter((c) => c.active || members[c.id] !== undefined)
      .sort((a, b) => a.serial - b.serial),
    visible = crew.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  async function addCrew() {
    const r = await Swal.fire({
      title: t('Add crew member'),
      input: 'text',
      showCancelButton: true,
      confirmButtonText: t('Save'),
      confirmButtonColor: '#242625',
    });
    if (!r.isConfirmed || !r.value?.trim()) return;
    try {
      const c = await api('/records/crew', {
        method: 'POST',
        body: JSON.stringify({
          name: r.value,
          serial: Math.max(0, ...data!.entities.crew.map((c) => c.serial)) + 1,
          isCaptain: false,
          active: true,
        }),
      });
      await refresh();
      setMembers((v) => ({ ...v, [c.id]: uniform || '0' }));
    } catch (e: any) {
      await failure(e.message);
    }
  }
  return (
    <RecordModal title={existing ? 'Edit wages' : 'Add wages'} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            if (!(await confirmAction(t('Save changes?')))) return;
            await api(`/crew/wages${existing ? `/${existing.id}` : ''}`, {
              method: existing ? 'PUT' : 'POST',
              body: JSON.stringify({
                date,
                notes,
                version: existing?.version,
                members: Object.entries(members).map(([crewId, amount]) => ({ crewId, amount })),
              }),
            });
            await refresh();
            onClose();
            await success(t('Saved successfully'));
          } catch (e: any) {
            await failure(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Date">
            <input
              type="date"
              required
              disabled={!!existing && existing.members.some((m: any) => paid(m.crewId))}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div>
            <Field label="Common wage">
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={uniform}
                onChange={(e) => setUniform(e.target.value)}
              />
            </Field>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setMembers((v) =>
                  Object.fromEntries(
                    Object.entries(v).map(([id, amount]) => [
                      id,
                      paid(id) ? amount : uniform || '0',
                    ]),
                  ),
                )
              }
            >
              {t('Apply to selected crew')}
            </button>
          </div>
          <div className="form-wide">
            <div className="crew-picker-top">
              <strong>{t('Select crew')}</strong>
              <button className="text-button" type="button" onClick={() => void addCrew()}>
                <Plus size={14} />
                {t('Add crew member')}
              </button>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label={t('Search crew')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search crew')}
              />
            </div>
            <label className="crew-check">
              <input
                type="checkbox"
                checked={!!crew.length && crew.every((c) => members[c.id] !== undefined)}
                onChange={(e) => {
                  if (e.target.checked)
                    setMembers((v) =>
                      Object.fromEntries(crew.map((c) => [c.id, v[c.id] ?? (uniform || '0')])),
                    );
                  else
                    setMembers((v) =>
                      Object.fromEntries(Object.entries(v).filter(([id]) => paid(id))),
                    );
                }}
              />
              {t('Select all')}
            </label>
            <div className="wage-crew-list">
              {visible.map((c) => (
                <div className="wage-member" key={c.id}>
                  <label className="crew-check">
                    <input
                      type="checkbox"
                      disabled={paid(c.id)}
                      checked={members[c.id] !== undefined}
                      onChange={(e) =>
                        setMembers((v) => {
                          const n = { ...v };
                          if (e.target.checked) n[c.id] = uniform || '0';
                          else delete n[c.id];
                          return n;
                        })
                      }
                    />
                    {c.name}
                    {paid(c.id) && <span className="badge paid">{t('Paid')}</span>}
                  </label>
                  {members[c.id] !== undefined && (
                    <input
                      aria-label={`${t('Salary')} ${c.name}`}
                      required
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      disabled={paid(c.id)}
                      value={members[c.id]}
                      onChange={(e) => setMembers((v) => ({ ...v, [c.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="form-wide">
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="wage-total">
          {t('Total amount')}{' '}
          <strong>
            {inr(
              Object.values(members)
                .reduce((n, v) => n.plus(v || 0), new Decimal(0))
                .toString(),
            )}
          </strong>
        </div>
        <div className="form-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button" disabled={busy || !Object.keys(members).length}>
            {t('Save')}
          </button>
        </div>
      </form>
    </RecordModal>
  );
}
