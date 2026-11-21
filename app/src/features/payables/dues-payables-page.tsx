'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Decimal } from 'decimal.js';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { RecordModal } from '../../components/ui/record-modal';
import { Field } from '../../components/ui/form-controls';
import { confirmAction, failure, success } from '../../components/ui/action-feedback';
import { saleBalance } from '../../../../shared/crew-ledger';
import { expenseBalance } from '../../../../shared/settlement-calculator';
import type { Entity } from '../../../../shared/models';
import { api, inr, today } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function DuesPayablesPage() {
  const { data } = useWorkspace(),
    t = useT(),
    [tab, setTab] = useState('Buyer dues'),
    [query, setQuery] = useState(''),
    [history, setHistory] = useState(false),
    [payment, setPayment] = useState<Entity | null>(null),
    [detail, setDetail] = useState<Entity | null>(null);
  if (!data) return null;
  if (!data.settings.fieldVisibility[data.user.role].some((v) => v === '*' || v === 'finance'))
    return <p>{t('Finance access required')}</p>;
  const buyers = tab === 'Buyer dues',
    balance = (r: Entity) => (buyers ? saleBalance(r) : expenseBalance(r)),
    all = buyers ? data.entities.sales.filter((s) => s.type === 'sale') : data.entities.expenses;
  const trip = (id: string) => data.entities.trips.find((t) => t.id === id);
  const label = (r: Entity) =>
    buyers
      ? r.buyer
      : r.supplier || data.entities.products.find((p) => p.id === r.productId)?.name || 'Supplier';
  const records = all.filter(
    (r) =>
      (history || Number(balance(r).balance) > 0) &&
      JSON.stringify([label(r), trip(r.tripId)?.name, r.phone, r.notes])
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const total = all.reduce((n, r) => n.plus(balance(r).balance), new Decimal(0));
  return (
    <>
      <PageHeader
        eyebrow="CASH FLOW"
        title="Dues & Payables"
        description="Money to receive and money to pay"
      />
      <div className="tabs">
        {['Buyer dues', 'Supplier payables'].map((l) => (
          <button
            key={l}
            className={tab === l ? 'selected' : ''}
            onClick={() => {
              setTab(l);
              setQuery('');
              setDetail(null);
              setPayment(null);
            }}
          >
            {t(l)}
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label={t('Search records')}
              value={query}
              placeholder={t('Search records')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              role="switch"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            <span className="switch-track" />
            {t('Include paid records')}
          </label>
          <strong>
            {t('Outstanding')}: {inr(total.toString())}
          </strong>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  'S.No.',
                  buyers ? 'Buyer / Agent' : 'Supplier',
                  'Trip',
                  'Date',
                  'Total amount',
                  buyers ? 'Received amount' : 'Paid amount',
                  'Balance',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...records].reverse().map((r, i) => {
                const b = balance(r);
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td className="strong">
                      {label(r)}
                      <small className="row-subtitle">
                        {buyers
                          ? r.phone
                          : data.entities.products.find((p) => p.id === r.productId)?.name}
                      </small>
                    </td>
                    <td>
                      <Link href={`/trip-details/${r.tripId}`}>{trip(r.tripId)?.name}</Link>
                    </td>
                    <td>{r.date}</td>
                    <td className="number">{inr(r.amount)}</td>
                    <td className="number">{inr(b.paid)}</td>
                    <td className="number">{inr(b.balance)}</td>
                    <td>
                      <span className={`badge ${Number(b.balance) > 0 ? 'pending' : 'paid'}`}>
                        {t(b.status)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="text-button" onClick={() => setDetail(r)}>
                          {t('Payment history')}
                        </button>
                        {data.user.role !== 'guest' && Number(b.balance) > 0 && (
                          <button className="button small" onClick={() => setPayment(r)}>
                            {t(buyers ? 'Receive payment' : 'Pay')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!records.length && (
                <tr>
                  <td colSpan={10} className="empty">
                    {t('No records yet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {detail && (
        <RecordModal title="Payment history" onClose={() => setDetail(null)}>
          <h3>{label(detail)}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Date', 'Amount', 'Notes', 'Recorded by'].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.payments || []).map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td>{inr(p.amount)}</td>
                    <td>{p.notes || '—'}</td>
                    <td>{p.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.payments === undefined && (
              <p className="notice">{t('Legacy record treated as fully paid')}</p>
            )}
          </div>
        </RecordModal>
      )}
      {payment && <PaymentForm record={payment} buyer={buyers} onClose={() => setPayment(null)} />}
    </>
  );
}
function PaymentForm({
  record,
  buyer,
  onClose,
}: {
  record: Entity;
  buyer: boolean;
  onClose: () => void;
}) {
  const t = useT(),
    { refresh } = useWorkspace(),
    [amount, setAmount] = useState((buyer ? saleBalance(record) : expenseBalance(record)).balance),
    [date, setDate] = useState(today()),
    [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <RecordModal title={buyer ? 'Receive payment' : 'Record payment'} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            if (!(await confirmAction(t('Confirm payment'), inr(amount), t('Confirm')))) return;
            await api(`/${buyer ? 'sales' : 'expenses'}/${record.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({ version: record.version, amount, date, notes }),
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
          <Field label="Amount">
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              max={(buyer ? saleBalance(record) : expenseBalance(record)).balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              required
              type="date"
              min={record.date}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div className="form-wide">
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" disabled={busy} className="button secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button disabled={busy} className="button">
            {t('Save')}
          </button>
        </div>
      </form>
    </RecordModal>
  );
}
