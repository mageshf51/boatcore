'use client';
import { useState } from 'react';
import { Plus, Search, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { Field, Switch } from '../../components/ui/form-controls';
import { confirmAction, failure, success } from '../../components/ui/action-feedback';
import { api } from '../../lib/api-client';
import { useT } from '../../lib/translations';
import type { Entity } from '../../../../shared/models';
export function SettingsPage() {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [tab, setTab] = useState<'crew' | 'products' | 'config'>('crew'),
    [search, setSearch] = useState('');
  if (!data) return null;
  const writable = data.user.role !== 'guest';
  async function edit(record?: Entity) {
    if (tab === 'config') return;
    const master = tab;
    const name = await Swal.fire({
      title: t(record ? 'Edit record' : 'Add record'),
      input: 'text',
      inputLabel: t('Name'),
      inputValue: record?.name || '',
      showCancelButton: true,
      confirmButtonText: t('Confirm'),
      confirmButtonColor: '#242625',
    });
    if (!name.isConfirmed || !name.value.trim()) return;
    const extra = await Swal.fire({
      title: t(master === 'crew' ? 'Serial number' : 'Unit'),
      input: master === 'crew' ? 'number' : 'text',
      inputValue:
        master === 'crew'
          ? record?.serial || Math.max(0, ...data!.entities.crew.map((c) => c.serial)) + 1
          : record?.unit || 'item',
      showCancelButton: true,
      confirmButtonText: t('Save'),
      confirmButtonColor: '#242625',
    });
    if (!extra.isConfirmed) return;
    let isCaptain = record?.isCaptain || false;
    if (master === 'crew') {
      const role = await Swal.fire({
        title: t('Captain'),
        input: 'checkbox',
        inputValue: isCaptain ? 1 : 0,
        inputPlaceholder: t('Eligible as captain'),
        showCancelButton: true,
        confirmButtonText: t('Save'),
        confirmButtonColor: '#242625',
      });
      if (!role.isConfirmed) return;
      isCaptain = Boolean(role.value);
    }
    try {
      await api(`/records/${master}${record ? `/${record.id}` : ''}`, {
        method: record ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: name.value,
          active: record?.active ?? true,
          version: record?.version,
          ...(master === 'crew'
            ? { serial: Number(extra.value), isCaptain }
            : { unit: extra.value }),
        }),
      });
      await refresh();
      await success(t('Saved successfully'));
    } catch (e: any) {
      await failure(e.message);
    }
  }
  async function toggle(r: Entity, v: boolean) {
    if (tab === 'config') return;
    try {
      await api(`/records/${tab}/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...r, active: v }),
      });
      await refresh();
    } catch (e: any) {
      await failure(e.message);
    }
  }
  return (
    <>
      <PageHeader eyebrow="WORKSPACE DATA" title="Masters & Settings" />
      <div className="tabs">
        {[
          ['crew', 'Crew members'],
          ['products', 'Products'],
          ['config', 'Configuration'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'selected' : ''}
            onClick={() => {
              setTab(key as any);
              setSearch('');
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'config' ? (
        <Configuration />
      ) : (
        <section className="panel">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                value={search}
                aria-label={t('Search')}
                placeholder={t('Search')}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {writable && (
              <button className="button small" onClick={() => void edit()}>
                <Plus size={16} />
                {t('Add record')}
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(tab === 'crew' ? 'Serial number' : 'Unit')}</th>
                  <th>{t('Name')}</th>
                  <th>{t('Active status')}</th>
                  <th>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.entities[tab]
                  .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
                  .sort((a, b) =>
                    tab === 'crew' ? a.serial - b.serial : a.name.localeCompare(b.name),
                  )
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{tab === 'crew' ? r.serial : r.unit}</td>
                      <td className="strong">
                        {r.name}
                        {tab === 'crew' && r.isCaptain && (
                          <small className="badge active">{t('Captain')}</small>
                        )}
                      </td>
                      <td>
                        <Switch
                          label="Active"
                          disabled={!writable}
                          checked={r.active}
                          onChange={(v) => void toggle(r, v)}
                        />
                      </td>
                      <td>
                        {writable && (
                          <button className="text-button" onClick={() => void edit(r)}>
                            {t('Edit')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
function Configuration() {
  const { data, refresh } = useWorkspace(),
    t = useT(),
    [rates, setRates] = useState(data?.settings);
  if (!data || !rates) return null;
  const readonly = data.user.role !== 'admin';
  return (
    <section className="panel record-form">
      <h2>{t('Configuration')}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await confirmAction(t('Save changes?')))) return;
          try {
            await api('/settings', { method: 'PUT', body: JSON.stringify(rates) });
            await refresh();
            await success(t('Saved successfully'));
          } catch (e: any) {
            await failure(e.message);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Commission percentage">
            <input
              required
              disabled={readonly}
              type="number"
              min="0"
              max="99"
              step="0.01"
              value={rates.commissionPercent}
              onChange={(e) => setRates({ ...rates, commissionPercent: e.target.value })}
            />
          </Field>
          <Field label="Crew percentage">
            <input
              required
              disabled={readonly}
              type="number"
              min="0"
              max="99"
              step="0.01"
              value={rates.crewPercent}
              onChange={(e) => setRates({ ...rates, crewPercent: e.target.value })}
            />
          </Field>
        </div>
        {!readonly && (
          <div className="form-actions">
            <button className="button">
              <Save size={16} />
              {t('Save')}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
