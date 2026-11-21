'use client';
import { CrewPaymentStatus } from '../../components/crew/crew-payment-status';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Users, LockKeyhole, Ship, Image } from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { SettlementSummary } from '../settlement/settlement-page';
import { AuditTable } from '../history/history-page';
import { expenseBalance } from '../../../../shared/settlement-calculator';
import { inr } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function TripDetailsPage({ id }: { id: string }) {
  const { data } = useWorkspace(),
    t = useT(),
    [tab, setTab] = useState('Overview');
  if (!data) return null;
  const trip = data.entities.trips.find((x) => x.id === id);
  if (!trip) return <p>{t('Trip not found')}</p>;
  const summary = data.summaries.find((s) => s.tripId === id),
    crew =
      trip.archiveCrew ||
      data.entities.crew
        .filter((c) => trip.crewIds.includes(c.id))
        .sort((a, b) => a.serial - b.serial),
    sales = data.entities.sales.filter((x) => x.tripId === id),
    expenses = data.entities.expenses.filter((x) => x.tripId === id),
    settlement = data.entities.settlements.find((x) => x.tripId === id);
  return (
    <>
      <Link className="back-link" href="/trip-details">
        <ArrowLeft size={15} />
        {t('Trip Details')}
      </Link>
      <PageHeader
        eyebrow="VOYAGE RECORD"
        title={trip.name}
        description={trip.notes}
        action={
          <span className={`badge ${trip.completed ? '' : 'active'}`}>
            {trip.completed ? <LockKeyhole size={13} /> : <Ship size={13} />}{' '}
            {t(trip.completed ? 'Completed' : 'Active')}
          </span>
        }
      />
      <div className="trip-facts">
        <span>
          <CalendarDays size={16} />
          {t('Departure')}: <strong>{trip.departure}</strong>
        </span>
        <span>
          {t('Return')}: <strong>{trip.returnDate || '—'}</strong>
        </span>
        <span>
          <Users size={16} />
          <strong>{crew.length}</strong> {t('Crew')}
        </span>
      </div>
      <div className="tabs" role="tablist">
        {(summary
          ? ['Overview', 'Crew shares', 'Sales', 'Expenses', 'Settlement', 'History']
          : ['Overview', 'History']
        ).map((label) => (
          <button
            role="tab"
            aria-selected={tab === label}
            key={label}
            className={tab === label ? 'selected' : ''}
            onClick={() => setTab(label)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'Overview' && (
        <div className="settlement-grid">
          <section className="panel detail-overview">
            <h2>{t('Trip information')}</h2>
            {[
              ['Trip', trip.name],
              ['Departure', trip.departure],
              ['Return', trip.returnDate || '—'],
              ['Crew count', crew.length],
              ['Notes', trip.notes || '—'],
            ].map(([k, v]) => (
              <div className="detail-line" key={k}>
                <span>{t(String(k))}</span>
                <strong>{v}</strong>
              </div>
            ))}
            <h3>{t('Crew members')}</h3>
            <div className="crew-tags">
              {crew.map((c: any) => (
                <span key={c.id}>
                  {c.serial}. {c.name} <CrewPaymentStatus tripId={id} crewId={c.id} />
                </span>
              ))}
            </div>
          </section>
          {summary && <SettlementSummary summary={summary} />}
        </div>
      )}
      {tab === 'Crew shares' && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                {['Crew', 'Share', 'Payout', 'Advance', 'Balance to pay', 'Status'].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.payouts.map((c: any) => (
                <tr key={c.crewId}>
                  <td>{c.name}</td>
                  <td>{c.weight}</td>
                  <td>{inr(c.amount)}</td>
                  <td>
                    {inr(
                      data.crewLedger.payments.find(
                        (p) =>
                          p.sourceType === 'trip' && p.sourceId === id && p.crewId === c.crewId,
                      )?.appliedAdvance ||
                        data.crewLedger.pending.find(
                          (p) =>
                            p.sourceType === 'trip' && p.sourceId === id && p.crewId === c.crewId,
                        )?.appliedAdvance ||
                        0,
                    )}
                  </td>
                  <td>
                    {inr(
                      data.crewLedger.payments.some(
                        (p) =>
                          p.sourceType === 'trip' && p.sourceId === id && p.crewId === c.crewId,
                      )
                        ? 0
                        : data.crewLedger.pending.find(
                            (p) =>
                              p.sourceType === 'trip' && p.sourceId === id && p.crewId === c.crewId,
                          )?.balance || c.amount,
                    )}
                  </td>
                  <td>
                    <CrewPaymentStatus tripId={id} crewId={c.crewId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel-heading">
            {t('Crew share pool')}: {inr(summary.crewPool)} · {t('Crew wages')}:{' '}
            {inr(summary.wages)}
          </div>
        </section>
      )}
      {tab === 'Sales' && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                {['Date', 'Type', 'Buyer / Agent', 'Phone', 'Amount', 'Notes', 'Bill'].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>
                    <span className="badge">{t(r.type === 'cash' ? 'Cash credit' : 'Sale')}</span>
                  </td>
                  <td>{r.buyer || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td className="number">{inr(r.amount)}</td>
                  <td>{r.notes}</td>
                  <td>
                    {r.attachmentId ? (
                      <a href={`/api/uploads/${r.attachmentId}`} target="_blank" rel="noreferrer">
                        {t('View')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <div className="empty">{t('No records yet')}</div>}
        </section>
      )}
      {tab === 'Expenses' && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  'Date',
                  'Product / item',
                  'Quantity',
                  'Unit price',
                  'Amount',
                  'Paid amount',
                  'Balance',
                  'Notes',
                  'Bill',
                  'Payment history',
                ].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const b = expenseBalance(e);
                return (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{data.entities.products.find((p) => p.id === e.productId)?.name}</td>
                    <td>{e.quantity}</td>
                    <td>{inr(e.unitPrice)}</td>
                    <td>{inr(e.amount)}</td>
                    <td>{inr(b.paid)}</td>
                    <td>
                      {inr(b.balance)}
                      <small className="row-subtitle">{t(b.status)}</small>
                    </td>
                    <td>{e.notes}</td>
                    <td>
                      {e.attachmentId ? (
                        <a href={`/api/uploads/${e.attachmentId}`} target="_blank" rel="noreferrer">
                          {t('View')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {e.payments.map((p: any) => (
                        <div className="payment-line" key={p.id}>
                          {p.date} · {inr(p.amount)}
                          <small>{p.actor}</small>
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!expenses.length && <div className="empty">{t('No records yet')}</div>}
        </section>
      )}
      {tab === 'Settlement' && (
        <div className="settlement-grid">
          <section className="panel detail-overview">
            <h2>{t('Settlement')}</h2>
            <div className="detail-line">
              <span>{t('Override cash')}</span>
              <strong>
                {settlement?.cashOverride === null || settlement?.cashOverride === undefined
                  ? '—'
                  : inr(settlement.cashOverride)}
              </strong>
            </div>
            <div className="detail-line">
              <span>{t('Override sales')}</span>
              <strong>
                {settlement?.salesOverride === null || settlement?.salesOverride === undefined
                  ? '—'
                  : inr(settlement.salesOverride)}
              </strong>
            </div>
            <div className="detail-line">
              <span>{t('Override reason')}</span>
              <strong>{settlement?.overrideReason || '—'}</strong>
            </div>
            <div className="detail-line">
              <span>{t('Recorded by')}</span>
              <strong>{settlement?.overrideBy || '—'}</strong>
            </div>
            <div className="detail-line">
              <span>{t('Time')}</span>
              <strong>{settlement?.overrideAt || '—'}</strong>
            </div>
          </section>
          {summary && <SettlementSummary summary={summary} />}
        </div>
      )}
      {tab === 'History' && (
        <section className="panel">
          <AuditTable events={data.audit.filter((a) => a.tripId === id)} />
        </section>
      )}
    </>
  );
}
