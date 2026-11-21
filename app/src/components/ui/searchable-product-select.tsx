'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import Swal from 'sweetalert2';
import type { Entity } from '../../../../shared/models';
import { useT } from '../../lib/translations';
import { api } from '../../lib/api-client';
import { failure } from './action-feedback';
export function SearchableProductSelect({
  products,
  value,
  onChange,
  onCreated,
}: {
  products: Entity[];
  value: string;
  onChange: (id: string) => void;
  onCreated: () => Promise<void>;
}) {
  const t = useT(),
    id = useId(),
    box = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    [query, setQuery] = useState(products.find((p) => p.id === value)?.name || ''),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false);
  const selected = products.find((p) => p.id === value);
  const options = products.filter(
    (p) => (p.active || p.id === value) && p.name.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected?.name, value]);
  useEffect(() => {
    input.current?.setCustomValidity(
      value && selected?.name === query ? '' : t('Choose a product from the list'),
    );
  }, [value, query, selected?.name, t]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  function choose(p: Entity) {
    onChange(p.id);
    setQuery(p.name);
    setOpen(false);
    input.current?.focus();
  }
  async function create() {
    if (busy) return;
    const result = await Swal.fire({
      title: t('Add product'),
      input: 'text',
      inputLabel: t('Name'),
      inputValue: query,
      showCancelButton: true,
      confirmButtonText: t('Confirm'),
      confirmButtonColor: '#242625',
    });
    if (!result.isConfirmed || !result.value?.trim()) return;
    const unit = await Swal.fire({
      title: t('Unit'),
      input: 'text',
      inputValue: 'item',
      showCancelButton: true,
      confirmButtonText: t('Save'),
      confirmButtonColor: '#242625',
    });
    if (!unit.isConfirmed || !unit.value?.trim()) return;
    setBusy(true);
    try {
      const p = await api('/records/products', {
        method: 'POST',
        body: JSON.stringify({ name: result.value.trim(), unit: unit.value.trim(), active: true }),
      });
      await onCreated();
      choose(p);
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="field product-combobox" ref={box}>
      <label htmlFor={id}>{t('Product / item')}</label>
      <div className="search-box">
        <Search size={16} />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
          required
          autoComplete="off"
          value={query}
          placeholder={t('Search or choose product')}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange('');
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((n) => Math.min(n + 1, options.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((n) => Math.max(0, n - 1));
            }
            if (e.key === 'Enter' && open) {
              e.preventDefault();
              if (options[active]) choose(options[active]);
            }
          }}
        />
        {selected && <Check size={15} />}
      </div>
      {open && (
        <div className="product-options">
          <div role="listbox" id={`${id}-options`}>
            {options.map((p, i) => (
              <button
                type="button"
                role="option"
                id={`${id}-${i}`}
                aria-selected={p.id === value}
                className={i === active ? 'highlight' : ''}
                key={p.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
              >
                {p.name}
                <small>{p.unit}</small>
              </button>
            ))}
            {!options.length && <p>{t('No matching records')}</p>}
          </div>
          <button
            type="button"
            className="text-button product-add"
            disabled={busy}
            onClick={() => void create()}
          >
            <Plus size={15} />
            {t('Add product')}
            {query ? ` · ${query}` : ''}
          </button>
        </div>
      )}
    </div>
  );
}
