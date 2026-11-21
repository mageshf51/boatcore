'use client';
import { useId, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useT } from '../../lib/translations';
import { api } from '../../lib/api-client';
import { failure } from './action-feedback';
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <label className="field">
      <span>{t(label)}</span>
      {children}
    </label>
  );
}
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <label className="switch-label">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" />
      <span>{t(label)}</span>
    </label>
  );
}
export function AttachmentInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useT(),
    [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null),
    picker = useRef<HTMLInputElement>(null);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api('/uploads', { method: 'POST', body: form });
      onChange(result.id);
    } catch (e: any) {
      await failure(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }
  return (
    <div className="attachment">
      <span className="label">{t('Bill image')}</span>
      <div className="button-row">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <ImagePlus size={16} />
          {busy ? '…' : t('Choose image')}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => camera.current?.click()}
        >
          <Camera size={16} />
          {t('Take photo')}
        </button>
      </div>
      <input
        ref={picker}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={upload}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={upload}
      />
      {value && (
        <div>
          <a href={`/api/uploads/${value}`} target="_blank" rel="noreferrer">
            <img className="bill-preview" src={`/api/uploads/${value}`} alt={t('Bill image')} />
          </a>
          <button type="button" className="text-button" onClick={() => onChange(null)}>
            <X size={14} />
            {t('Remove image')}
          </button>
        </div>
      )}
    </div>
  );
}
