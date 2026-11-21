'use client';
import { CrewPaymentStatus } from '../../components/crew/crew-payment-status';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Eye, Pencil, Filter, AlertTriangle, Image, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { Switch } from '../../components/ui/form-controls';
import { confirmAction, failure, success } from '../../components/ui/action-feedback';
import { api, inr, today } from '../../lib/api-client';
import { useT } from '../../lib/translations';
import { expenseBalance } from '../../../../shared/settlement-calculator';
import type { Entity } from '../../../../shared/models';
import Swal from 'sweetalert2';
export function RecordListPage({
  module,
}: {
  module: 'trips' | 'sales' | 'expenses' | 'trip-details';
}) {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [outstanding, setOutstanding] = useState(true),
    [expanded, setExpanded] = useState<string[]>([]);
  if (!data) return null;
  const writable = data.user.role !== 'guest',
    isTrips = module === 'trips' || module === 'trip-details';
  const title = {
    trips: 'Trips',
    sales: 'Quick Sales',
    expenses: 'Expenses',
    'trip-details': 'Trip Details',
  }[module];
  const records = data.entities[isTrips ? 'trips' : (module as 'sales' | 'expenses')];
  const trip = (id: string) => data.entities.trips.find((x) => x.id === id);
  const filtered = [...records].reverse().filter((r) => {
    const text = JSON.stringify([
      r.name,
      r.buyer,
      r.notes,
      r.phone,
      trip(r.tripId)?.name,
      data.entities.products.find((p) => p.id === r.productId)?.name,
    ]).toLowerCase();
    if (!text.includes(search.toLowerCase())) return false;
    if (isTrips && status !== 'all' && Boolean(r.completed) !== (status === 'completed'))
      return false;
    if (module === 'sales' && status !== 'all' && r.type !== status) return false;
    if (module === 'expenses' && outstanding && Number(expenseBalance(r).balance) <= 0)
      return false;
    return true;
  });
  async function endTrip(r: Entity) {
    const result = await Swal.fire({
      title: t('End Trip'),
      input: 'date',
      inputValue: today(),
      inputAttributes: { min: r.departure },
      showCancelButton: true,
      confirmButtonText: t('Confirm'),
      confirmButtonColor: '#242625',
      inputValidator: (value) => (!value || value < r.departure ? t('Return date') : undefined),
    });
    if (!result.isConfirmed) return;
    try {
      await api(`/records/trips/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...r, returnDate: result.value }),
      });
      await refresh();
      await success(t('Saved successfully'));
    } catch (e: any) {
      await failure(e.message);
    }
  }
  async function pay(r: Entity) {
    const balance = expenseBalance(r).balance;
    const result = await Swal.fire({
      title: t('Record payment'),
      text: `${t('Balance')}: ${inr(balance)}`,
      input: 'number',
      inputValue: balance,
      inputAttributes: { min: '0.01', max: balance, step: '0.01' },
      showCancelButton: true,
      confirmButtonText: t('Save'),
      confirmButtonColor: '#242625',
    });
    if (!result.isConfirmed) return;
    try {
      await api(`/expenses/${r.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: result.value, date: today(), version: r.version }),
      });
      await refresh();
      await success(t('Saved successfully'));
    } catch (e: any) {
      await failure(e.message);
    }
  }
  const columns = isTrips
    ? ['S.No.', 'Trip', 'Departure', 'Crew', 'Return', 'Notes', 'Actions']
    : module === 'sales'
      ? [
          'S.No.',
          'Buyer / Agent',
          'Trip',
          'Type',
          'Date',
          'Bill amount',
          'Notes',
          'Bill',
          'Actions',
        ]
      : [
          'Trip',
          'Date',
          'Product / item',
          'Quantity',
          'Total amount',
          'Paid amount',
          'Balance',
          'Status',
          'Bill',
          'Actions',
        ];
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title={title}
        description={
          module === 'trip-details'
            ? 'Operational fields reset after completion.'
            : 'Latest saved records'
        }
        action={
          writable && module !== 'trip-details' ? (
            <Link className={`button ${module === 'sales' ? 'blue' : ''}`} href={`/${module}/new`}>
              <Plus size={17} />
              {t(
                module === 'trips'
                  ? 'Add New Trip'
                  : module === 'sales'
                    ? 'Add New Sale'
                    : 'Add New Expense',
              )}
            </Link>
          ) : undefined
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label={t('Search records')}
              placeholder={t('Search records')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="button-row">
            {module === 'expenses' ? (
              <Switch label="Outstanding only" checked={outstanding} onChange={setOutstanding} />
            ) : (
              <>
                <Filter size={16} />
                <select
                  aria-label={t('Status')}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {(isTrips
                    ? [
                        ['all', 'All'],
                        ['active', 'Active'],
                        ['completed', 'Completed'],
                      ]
                    : [
                        ['all', 'All'],
                        ['sale', 'Sale'],
                        ['cash', 'Cash credit'],
                      ]
                  ).map(([v, l]) => (
                    <option key={v} value={v}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <span className="record-count">
              {filtered.length} {t('Record')}
            </span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((x) => (
                  <th key={x}>{t(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const parent = isTrips ? r : trip(r.tripId),
                  canEdit = writable && !parent?.completed,
                  balance = module === 'expenses' ? expenseBalance(r) : null;
                const detail = `/trip-details/${isTrips ? r.id : r.tripId}`;
                return (
                  <tr key={r.id}>
                    {isTrips ? (
                      <>
                        <td>{String(i + 1).padStart(2, '0')}</td>
                        <td className="strong">
                          <Link href={detail}>{r.name}</Link>
                          <small className="row-subtitle">
                            {t(r.completed ? 'Completed' : 'Active')}
                          </small>
                        </td>
                        <td>{r.departure}</td>
                        <td>
                          <button
                            className="crew-expand"
                            onClick={() =>
                              setExpanded((v) =>
                                v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id],
                              )
                            }
                          >
                            {r.crewIds.length} {t('Crew')}
                            <ChevronDown size={13} />
                          </button>
                          {expanded.includes(r.id) && (
                            <div className="crew-names">
                              {data.entities.crew
                                .filter((c) => r.crewIds.includes(c.id))
                                .sort((a, b) => a.serial - b.serial)
                                .map((c) => (
                                  <span key={c.id}>
                                    <Link href={`/crew?person=${c.id}`}>
                                      {c.serial}. {c.name}
                                    </Link>{' '}
                                    <CrewPaymentStatus tripId={r.id} crewId={c.id} />
                                  </span>
                                ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {r.returnDate ||
                            (canEdit && module === 'trips' ? (
                              <button
                                className="button warning small"
                                onClick={() => void endTrip(r)}
                              >
                                {t('End Trip')}
                              </button>
                            ) : (
                              '—'
                            ))}
                        </td>
                        <td className="notes-cell">{r.notes || '—'}</td>
                      </>
                    ) : module === 'sales' ? (
                      <>
                        <td>{i + 1}</td>
                        <td className="strong">
                          {r.type === 'cash' ? t('Cash credit') : r.buyer}
                          <small className="row-subtitle">{r.phone}</small>
                        </td>
                        <td>{parent?.name}</td>
                        <td>
                          <span className={`badge ${r.type === 'cash' ? 'cash' : ''}`}>
                            {t(r.type === 'cash' ? 'Cash credit' : 'Sale')}
                          </span>
                        </td>
                        <td>{r.date}</td>
                        <td className="number">{inr(r.amount)}</td>
                        <td className="notes-cell">{r.notes || '—'}</td>
                        <td>
                          {r.attachmentId ? (
                            <a
                              className="icon-button"
                              aria-label={t('Bill image')}
                              href={`/api/uploads/${r.attachmentId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Image size={17} />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="strong">{parent?.name}</td>
                        <td>{r.date}</td>
                        <td>{data.entities.products.find((p) => p.id === r.productId)?.name}</td>
                        <td>{r.quantity}</td>
                        <td className="number">{inr(r.amount)}</td>
                        <td className="number">{inr(balance!.paid)}</td>
                        <td className="number">{inr(balance!.balance)}</td>
                        <td>
                          <span
                            className={`badge ${Number(balance!.balance) > 0 ? 'pending' : ''}`}
                          >
                            {Number(balance!.balance) > 0 && <AlertTriangle size={12} />}{' '}
                            {t(balance!.status)}
                          </span>
                        </td>
                        <td>
                          {r.attachmentId ? (
                            <a
                              className="icon-button"
                              aria-label={t('Bill image')}
                              href={`/api/uploads/${r.attachmentId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Image size={17} />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                    <td>
                      <div className="row-actions">
                        <Link
                          title={t('View')}
                          aria-label={t('View')}
                          className="icon-button"
                          href={detail}
                        >
                          <Eye size={17} />
                        </Link>
                        {canEdit && module !== 'trip-details' && (
                          <Link
                            className="icon-button"
                            title={t('Edit')}
                            aria-label={t('Edit')}
                            href={`/${module}/${r.id}/edit`}
                          >
                            <Pencil size={16} />
                          </Link>
                        )}
                        {module === 'expenses' && writable && Number(balance!.balance) > 0 && (
                          <button className="text-button" onClick={() => void pay(r)}>
                            {t('Record payment')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={columns.length} className="empty">
                    <div className="empty-icon">≋</div>
                    {t('No records yet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
