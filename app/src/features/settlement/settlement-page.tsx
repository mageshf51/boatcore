'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Save, CheckCheck, LockKeyhole, Calculator } from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { Field, Switch } from '../../components/ui/form-controls';
import { confirmAction, failure, success } from '../../components/ui/action-feedback';
import { api, inr } from '../../lib/api-client';
import { useT } from '../../lib/translations';
import { captainIdFor } from '../../../../shared/captain-rules';
import { CrewPaymentStatus } from '../../components/crew/crew-payment-status';
import { calculateSettlement } from '../../../../shared/settlement-calculator';
import type { Entity } from '../../../../shared/models';
export function SettlementPage() {
  const { data } = useWorkspace(),
    t = useT(),
    [tripId, setTripId] = useState('');
  if (!data) return null;
  if (!data.settings.fieldVisibility[data.user.role].some((v) => v === '*' || v === 'finance'))
    return <p>Finance access required</p>;
  const trips = data.entities.trips.filter((t) => !t.completed);
  const trip = trips.find((t) => t.id === tripId);
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTING"
        title="Trip Settlement"
        description="Operational fields reset after completion."
      />
      <div className="panel trip-selector">
        <Field label="Select trip">
          <select value={tripId} onChange={(e) => setTripId(e.target.value)}>
            <option value="">{t('Select trip')}</option>
            {trips.map((trip) => (
              <option value={trip.id} key={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </Field>
        <Link className="text-button" href="/trip-details">
          {t('Trip Details')} →
        </Link>
      </div>
      {trip ? (
        <SettlementEditor key={trip.id} trip={trip} onComplete={() => setTripId('')} />
      ) : (
        <div className="panel empty large-empty">
          <Calculator size={34} />
          <h2>{t(trips.length ? 'Select trip' : 'No active trips')}</h2>
          <p>{t('Create a trip to start recording operations.')}</p>
        </div>
      )}
    </>
  );
}
function SettlementEditor({ trip, onComplete }: { trip: Entity; onComplete: () => void }) {
  const { data, refresh } = useWorkspace(),
    t = useT();
  const saved = data?.entities.settlements.find((s) => s.tripId === trip.id);
  const [form, setForm] = useState<any>(
      saved || {
        tripId: trip.id,
        deduction: '0',
        wages: '0',
        extraShareIds: [],
        deductedExpenseIds: [],
        cashOverride: null,
        salesOverride: null,
        overrideReason: '',
      },
    ),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  if (!data) return null;
  const readonly = data.user.role === 'guest';
  const crew = data.entities.crew.filter((c) => trip.crewIds.includes(c.id));
  const summary = calculateSettlement(
    trip.id,
    data.entities.sales,
    data.entities.expenses,
    crew,
    { ...form, captainId: trip.captainId },
    data.settings,
  );
  const set = (key: string, value: any) => {
    setDirty(true);
    setForm((f: any) => ({ ...f, [key]: value }));
  };
  async function save() {
    if (!(await confirmAction(t('Save changes?'), undefined, t('Confirm')))) return;
    setBusy(true);
    try {
      const result = await api(`/records/settlements${saved ? `/${saved.id}` : ''}`, {
        method: saved ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          extraShareIds: form.extraShareIds.filter(
            (id: string) => id === captainIdFor(crew, trip.captainId),
          ),
          version: saved?.version,
        }),
      });
      setForm(result);
      setDirty(false);
      await refresh();
      await success(t('Saved successfully'));
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    if (
      !(await confirmAction(
        t('Complete and archive this trip?'),
        t('This locks operational fields. Details remain available in Trip Details.'),
        t('Confirm'),
      ))
    )
      return;
    setBusy(true);
    try {
      await api(`/trips/${trip.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ version: trip.version }),
      });
      await refresh();
      onComplete();
      await success(t('Saved successfully'));
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settlement-grid">
      <section className="panel settlement-inputs">
        <div className="panel-heading">
          <h2>{trip.name}</h2>
          <span className="badge active">{t('Active')}</span>
        </div>
        <div className="form-grid">
          <Field label="Manual deduction">
            <input
              disabled={readonly}
              type="number"
              min="0"
              step="0.01"
              value={form.deduction}
              onChange={(e) => set('deduction', e.target.value)}
            />
          </Field>
          <Field label="Crew wages">
            <input
              disabled={readonly}
              type="number"
              min="0"
              step="0.01"
              value={form.wages}
              onChange={(e) => set('wages', e.target.value)}
            />
          </Field>
          <div>
            <Switch
              label="Override cash"
              disabled={readonly}
              checked={form.cashOverride !== null}
              onChange={(v) => set('cashOverride', v ? summary.sourceCash : null)}
            />
            {form.cashOverride !== null && (
              <input
                aria-label={t('Override cash')}
                type="number"
                min="0"
                step="0.01"
                value={form.cashOverride}
                disabled={readonly}
                onChange={(e) => set('cashOverride', e.target.value)}
              />
            )}
            <small>
              {t('Source value')}: {inr(summary.sourceCash)}
            </small>
          </div>
          <div>
            <Switch
              label="Override sales"
              disabled={readonly}
              checked={form.salesOverride !== null}
              onChange={(v) => set('salesOverride', v ? summary.sourceSales : null)}
            />
            {form.salesOverride !== null && (
              <input
                aria-label={t('Override sales')}
                type="number"
                min="0"
                step="0.01"
                value={form.salesOverride}
                disabled={readonly}
                onChange={(e) => set('salesOverride', e.target.value)}
              />
            )}
            <small>
              {t('Source value')}: {inr(summary.sourceSales)}
            </small>
          </div>
          {(form.cashOverride !== null || form.salesOverride !== null) && (
            <div className="form-wide">
              <Field label="Override reason">
                <textarea
                  disabled={readonly}
                  required
                  value={form.overrideReason}
                  onChange={(e) => set('overrideReason', e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
        <h3>{t('Expenses included in deduction')}</h3>
        <p className="muted">{t('Included expenses are deducted once.')}</p>
        {data.entities.expenses
          .filter((e) => e.tripId === trip.id)
          .map((e) => (
            <label className="crew-check" key={e.id}>
              <input
                type="checkbox"
                disabled={readonly}
                checked={form.deductedExpenseIds.includes(e.id)}
                onChange={(v) =>
                  set(
                    'deductedExpenseIds',
                    v.target.checked
                      ? [...form.deductedExpenseIds, e.id]
                      : form.deductedExpenseIds.filter((id: string) => id !== e.id),
                  )
                }
              />
              {data.entities.products.find((p) => p.id === e.productId)?.name}
              <strong>{inr(e.amount)}</strong>
            </label>
          ))}
        <h3>{t('Crew shares')}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Crew')}</th>
                <th>+0.5 {t('Share')}</th>
                <th>{t('Payout')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.payouts.map((c) => (
                <tr key={c.crewId}>
                  <td>{c.name}</td>
                  <td>
                    {c.crewId === captainIdFor(crew, trip.captainId) ? (
                      <Switch
                        label="+0.5"
                        disabled={readonly}
                        checked={c.weight === '1.5'}
                        onChange={(v) =>
                          set(
                            'extraShareIds',
                            v
                              ? [...form.extraShareIds, c.crewId]
                              : form.extraShareIds.filter((id: string) => id !== c.crewId),
                          )
                        }
                      />
                    ) : (
                      <span className="muted">1 {t('Share')}</span>
                    )}
                  </td>
                  <td className="number">
                    {inr(c.amount)}
                    <small className="row-subtitle">
                      <CrewPaymentStatus tripId={trip.id} crewId={c.crewId} />
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          {t('Total share units')}: {summary.totalUnits}
        </p>
        {!readonly && (
          <div className="form-actions">
            <button className="button" disabled={busy} onClick={() => void save()}>
              <Save size={16} />
              {t('Save settlement')}
            </button>
            <button
              className="button warning"
              disabled={busy || dirty || !saved || !trip.returnDate}
              onClick={() => void complete()}
            >
              <CheckCheck size={16} />
              {t('Complete trip')}
            </button>
          </div>
        )}
      </section>
      <SettlementSummary summary={summary} />
    </div>
  );
}
export function SettlementSummary({ summary }: { summary: any }) {
  const t = useT();
  return (
    <aside className="panel settlement-summary">
      <span className="eyebrow">TRIP BREAKDOWN</span>
      <h2>{t('Settlement')}</h2>
      {[
        ['Cash credits', 'cash'],
        ['Gross sales', 'grossSales'],
        ['Sales commission', 'commission'],
        ['Net sales', 'netSales'],
        ['Manual deduction', 'deduction'],
      ].map(([label, key]) => (
        <div className="summary-line" key={key}>
          <span>{t(label)}</span>
          <strong>{inr(summary[key])}</strong>
        </div>
      ))}
      <div className="revenue-highlight">
        <span>{t('Trip Revenue')}</span>
        <strong>{inr(summary.revenue)}</strong>
      </div>
      {[
        ['Expenses', 'expenses'],
        ['Crew share pool', 'crewPool'],
        ['Crew wages', 'wages'],
      ].map(([label, key]) => (
        <div className="summary-line" key={key}>
          <span>{t(label)}</span>
          <strong>{inr(summary[key])}</strong>
        </div>
      ))}
      <div className="profit-line">
        <span>{t('Profit / Loss')}</span>
        <strong className={Number(summary.profit) >= 0 ? 'positive' : 'negative'}>
          {Number(summary.profit) > 0 ? '+' : ''}
          {inr(summary.profit)}
        </strong>
      </div>
    </aside>
  );
}
