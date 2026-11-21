'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Save } from 'lucide-react';
import { Decimal } from 'decimal.js';
import Swal from 'sweetalert2';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { SearchableProductSelect } from '../../components/ui/searchable-product-select';
import { saleBalance } from '../../../../shared/crew-ledger';
import { Field, AttachmentInput, Switch } from '../../components/ui/form-controls';
import { confirmAction, success, failure } from '../../components/ui/action-feedback';
import { api, inr, today } from '../../lib/api-client';
import { useT } from '../../lib/translations';
import type { Entity } from '../../../../shared/models';
export function RecordFormPage({
  kind,
  id,
}: {
  kind: 'trips' | 'sales' | 'expenses';
  id?: string;
}) {
  const { data } = useWorkspace(),
    t = useT();
  if (!data) return null;
  const existing = data.entities[kind].find((r) => r.id === id);
  if (id && !existing) return <p>{t('Record not found')}</p>;
  if (data.user.role === 'guest') return <p>{t('Guest access is read only')}</p>;
  return <RecordForm key={existing?.id || 'new'} kind={kind} existing={existing} />;
}
function RecordForm({
  kind,
  existing,
}: {
  kind: 'trips' | 'sales' | 'expenses';
  existing?: Entity;
}) {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    router = useRouter();
  const [form, setForm] = useState<any>(
      existing || {
        name: '',
        departure: today(),
        crewIds: [],
        captainId: null,
        supplier: '',
        notes: '',
        returnDate: null,
        tripId: '',
        date: today(),
        type: 'sale',
        buyer: '',
        phone: '',
        amount: '',
        productId: '',
        quantity: '1',
        unitPrice: '',
        initialPaid: '0',
        attachmentId: null,
      },
    ),
    [busy, setBusy] = useState(false),
    [crewSearch, setCrewSearch] = useState(''),
    [saleFullyPaid, setSaleFullyPaid] = useState(true);
  if (!data) return null;
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value })),
    activeTrips = data.entities.trips.filter((v) => !v.completed),
    locked =
      existing &&
      (kind === 'trips'
        ? existing.completed
        : data.entities.trips.find((t) => t.id === existing.tripId)?.completed);
  if (locked)
    return (
      <div className="panel empty">
        {t('Completed')} ·{' '}
        <Link href={`/trip-details/${kind === 'trips' ? existing.id : existing.tripId}`}>
          {t('Trip Details')}
        </Link>
      </div>
    );
  const allCrew = data.entities.crew
      .filter((c) => c.active || form.crewIds?.includes(c.id))
      .sort((a, b) => a.serial - b.serial),
    crew = allCrew.filter((c) => c.name.toLowerCase().includes(crewSearch.toLowerCase()));
  async function addMaster(master: 'crew' | 'products') {
    const result = await Swal.fire({
      title: t(master === 'crew' ? 'Add crew member' : 'Add product'),
      input: 'text',
      inputLabel: t('Name'),
      showCancelButton: true,
      confirmButtonText: t('Save'),
      confirmButtonColor: '#242625',
      inputValidator: (value) => (!value.trim() ? t('Name') : undefined),
    });
    if (!result.isConfirmed) return;
    try {
      const record = await api(`/records/${master}`, {
        method: 'POST',
        body: JSON.stringify(
          master === 'crew'
            ? {
                name: result.value,
                serial: Math.max(0, ...data!.entities.crew.map((c) => c.serial)) + 1,
                active: true,
              }
            : { name: result.value, unit: 'item', active: true },
        ),
      });
      if (master === 'crew') set('crewIds', [...form.crewIds, record.id]);
      else set('productId', record.id);
      await refresh();
    } catch (e: any) {
      await failure(e.message);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!(await confirmAction(t('Save changes?'), undefined, t('Confirm')))) return;
    setBusy(true);
    try {
      await api(`/records/${kind}${existing ? `/${existing.id}` : ''}`, {
        method: existing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          ...(kind === 'sales' && !existing
            ? {
                initialPaid: form.type === 'cash' || saleFullyPaid ? form.amount : form.initialPaid,
              }
            : {}),
          ...(kind === 'trips'
            ? { captainId: form.crewIds.includes(form.captainId) ? form.captainId : null }
            : {}),
        }),
      });
      await refresh();
      await success(t('Saved successfully'));
      router.push(`/${kind}`);
    } catch (e: any) {
      await failure(e.message, t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href={`/${kind}`}>
        <ArrowLeft size={15} />
        {t('Back')}
      </Link>
      <PageHeader
        eyebrow="NEW RECORD"
        title={
          existing
            ? 'Edit record'
            : kind === 'trips'
              ? 'Add New Trip'
              : kind === 'sales'
                ? 'Add New Sale'
                : 'Add New Expense'
        }
        action={
          kind === 'sales' && !existing ? (
            <button
              className="button warning"
              onClick={() => set('type', form.type === 'cash' ? 'sale' : 'cash')}
            >
              <Plus size={16} />
              {t(form.type === 'cash' ? 'Sale' : 'Add Cash')}
            </button>
          ) : undefined
        }
      />
      <form className="panel record-form" onSubmit={save}>
        <div className="form-section-title">
          <span>01</span>
          <h2>
            {t(kind === 'trips' ? 'Trip information' : kind === 'sales' ? 'Sale' : 'Expenses')}
          </h2>
        </div>
        <div className="form-grid">
          {kind === 'trips' ? (
            <>
              <Field label="Trip name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label="Departure">
                <input
                  required
                  type="date"
                  value={form.departure}
                  onChange={(e) => set('departure', e.target.value)}
                />
              </Field>
              <Field label="Crew count">
                <input readOnly value={form.crewIds.length} />
              </Field>
              <Field label="Captain">
                <select
                  value={form.crewIds.includes(form.captainId) ? form.captainId || '' : ''}
                  onChange={(e) => set('captainId', e.target.value || null)}
                >
                  <option value="">{t('Auto-select eligible captain')}</option>
                  {allCrew
                    .filter((c) => c.isCaptain && form.crewIds.includes(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              {existing?.returnDate && (
                <Field label="Return date">
                  <input
                    type="date"
                    required
                    min={form.departure}
                    value={form.returnDate}
                    onChange={(e) => set('returnDate', e.target.value)}
                  />
                </Field>
              )}
              <div className="form-wide crew-picker">
                <div className="crew-picker-top">
                  <strong>{t('Select crew')}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void addMaster('crew')}
                  >
                    <Plus size={15} />
                    {t('Add crew member')}
                  </button>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder={t('Search crew')}
                    value={crewSearch}
                    onChange={(e) => setCrewSearch(e.target.value)}
                  />
                </div>
                <label className="crew-check">
                  <input
                    type="checkbox"
                    checked={!!allCrew.length && allCrew.every((c) => form.crewIds.includes(c.id))}
                    onChange={(e) =>
                      set('crewIds', e.target.checked ? allCrew.map((c) => c.id) : [])
                    }
                  />
                  {t('Select all')}
                  <span>
                    {form.crewIds.length}/{allCrew.length}
                  </span>
                </label>
                <div className="crew-check-grid">
                  {crew.map((c) => (
                    <label className="crew-check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={form.crewIds.includes(c.id)}
                        onChange={(e) =>
                          set(
                            'crewIds',
                            e.target.checked
                              ? [...new Set([...form.crewIds, c.id])]
                              : form.crewIds.filter((id: string) => id !== c.id),
                          )
                        }
                      />
                      <small>{String(c.serial).padStart(2, '0')}</small>
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label="Trip">
                <select
                  required
                  value={form.tripId}
                  onChange={(e) => set('tripId', e.target.value)}
                  disabled={!!existing}
                >
                  <option value="">{t('Select trip')}</option>
                  {activeTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </Field>
              {kind === 'sales' ? (
                <>
                  <div className="form-wide">
                    <Switch
                      label="Cash credit"
                      checked={form.type === 'cash'}
                      onChange={(v) => set('type', v ? 'cash' : 'sale')}
                    />
                  </div>
                  {form.type === 'sale' && (
                    <>
                      <Field label="Buyer / Agent">
                        <input
                          required
                          value={form.buyer}
                          onChange={(e) => set('buyer', e.target.value)}
                        />
                      </Field>
                      <Field label="Phone">
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => set('phone', e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Bill amount">
                    <input
                      required
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="9999999999"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => set('amount', e.target.value)}
                    />
                  </Field>
                  {form.type === 'sale' && !existing && (
                    <>
                      <div className="form-wide">
                        <Switch
                          label="Fully received"
                          checked={saleFullyPaid}
                          onChange={setSaleFullyPaid}
                        />
                      </div>
                      {!saleFullyPaid && (
                        <Field label="Received amount">
                          <input
                            type="number"
                            required
                            min="0"
                            max={form.amount || 0}
                            step="0.01"
                            value={form.initialPaid}
                            onChange={(e) => set('initialPaid', e.target.value)}
                          />
                        </Field>
                      )}
                    </>
                  )}
                  {existing && form.type === 'sale' && (
                    <p className="notice">
                      {t('Received amount')}: {inr(saleBalance(existing).paid)} ·{' '}
                      {t('Record subsequent receipts in Dues & Payables')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <SearchableProductSelect
                    products={data.entities.products}
                    value={form.productId}
                    onChange={(id) => set('productId', id)}
                    onCreated={refresh}
                  />
                  <Field label="Supplier">
                    <input
                      value={form.supplier || ''}
                      maxLength={200}
                      onChange={(e) => set('supplier', e.target.value)}
                    />
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      required
                      min="0.001"
                      step="0.001"
                      value={form.quantity}
                      onChange={(e) => set('quantity', e.target.value)}
                    />
                  </Field>
                  <Field label="Unit price">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={form.unitPrice}
                      onChange={(e) => set('unitPrice', e.target.value)}
                    />
                  </Field>
                  <Field label="Total amount">
                    <input
                      readOnly
                      value={inr(
                        new Decimal(form.quantity || 0).mul(form.unitPrice || 0).toFixed(2),
                      )}
                    />
                  </Field>
                  {!existing && (
                    <Field label="Paid amount">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.initialPaid}
                        onChange={(e) => set('initialPaid', e.target.value)}
                      />
                    </Field>
                  )}
                </>
              )}
              <div className="form-wide">
                <AttachmentInput
                  value={form.attachmentId}
                  onChange={(id) => set('attachmentId', id)}
                />
              </div>
            </>
          )}
          <div className="form-wide">
            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={2000}
              />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <Link className="button secondary" href={`/${kind}`}>
            {t('Cancel')}
          </Link>
          <button className="button" disabled={busy}>
            <Save size={16} />
            {busy ? '…' : t('Save')}
          </button>
        </div>
      </form>
    </>
  );
}
