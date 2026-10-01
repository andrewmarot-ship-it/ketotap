import { useState } from 'react';
import { foodsApi, nutritionApi } from '../api/client';
import { guessEmoji } from '../utils/emoji';
import BarcodeScanner from './BarcodeScanner';
import './ScanFlow.css';

const EMPTY = { name: '', serving_description: '', calories: '', fat_g: '', protein_g: '', total_carbs_g: '', fiber_g: '' };
const NUMERIC = ['calories', 'fat_g', 'protein_g', 'total_carbs_g', 'fiber_g'];

const sameBarcode = (a, b) => String(a).replace(/^0+/, '') === String(b).replace(/^0+/, '');
const r1 = v => Math.round(v * 10) / 10;

function formatBarcode(code) {
  return code.length === 13 ? `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`
    : code.length === 12 ? `${code[0]} ${code.slice(1, 6)} ${code.slice(6, 11)} ${code[11]}`
    : code;
}

// Scan → (already saved | look up → found / not found) → save, optionally logging one serving
export default function ScanFlow({ foods, onSave, onLogExisting, onClose, getLimitWarning }) {
  const [step, setStep] = useState('scan');
  const [code, setCode] = useState('');
  const [existing, setExisting] = useState(null);
  const [source, setSource] = useState(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleDetected(raw) {
    const digits = String(raw).replace(/\D/g, '');
    setCode(digits);

    const saved = foods.find(f => f.barcode && sameBarcode(f.barcode, digits));
    if (saved) {
      setExisting(saved);
      setStep('existing');
      return;
    }

    setStep('lookup');
    try {
      const { data } = await nutritionApi.barcode(digits);
      const value = v => (v === null || v === undefined ? '' : v);
      setForm({
        name: data.name || '',
        serving_description: data.serving_description || '',
        calories: value(data.calories),
        fat_g: value(data.fat_g),
        protein_g: value(data.protein_g),
        total_carbs_g: value(data.total_carbs_g),
        fiber_g: value(data.fiber_g),
      });
      // Only mark fields the database actually supplied
      setAutoFilled(new Set(['serving_description', ...NUMERIC].filter(k => data[k] !== null && data[k] !== undefined && data[k] !== '')));
      setSource(data.source);
      setNotice(data.incomplete
        ? `${data.source} knows this product but not all of its nutrition. Fill in the blank fields from the label.`
        : '');
    } catch (err) {
      setForm(EMPTY);
      setAutoFilled(new Set());
      setSource(null);
      setNotice(err.response?.status === 404
        ? "Not in the database yet. Enter it from the label once. It's saved with this barcode, so next time the scan is instant."
        : "Couldn't reach the food databases right now. You can enter it from the label instead.");
    }
    setStep('form');
  }

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setAutoFilled(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  const total = parseFloat(form.total_carbs_g);
  const fiber = parseFloat(form.fiber_g) || 0;
  const netCarbs = Number.isFinite(total) ? Math.max(0, r1(total - fiber)) : null;

  const formWarning = getLimitWarning && Number.isFinite(total)
    ? getLimitWarning({ carbs_g: netCarbs, calories: Number(form.calories) || 0 })
    : null;
  const existingWarning = getLimitWarning && existing
    ? getLimitWarning({ carbs_g: existing.carbs_g, calories: existing.calories })
    : null;

  async function save(andLog) {
    setError('');
    const missing = ['name', 'serving_description', 'calories', 'fat_g', 'protein_g', 'total_carbs_g']
      .some(k => String(form[k]).trim() === '');
    if (missing) {
      setError('Fill in the name, serving and all macros from the label.');
      return;
    }
    setSaving(true);
    try {
      const { data: food } = await foodsApi.create({
        name: form.name.trim(),
        serving_description: form.serving_description.trim(),
        calories: Number(form.calories),
        fat_g: Number(form.fat_g),
        protein_g: Number(form.protein_g),
        carbs_g: netCarbs ?? 0,
        fiber_g: fiber,
        barcode: code,
        emoji: guessEmoji(form.name),
      });
      await onSave(food, andLog);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Try again.');
      setSaving(false);
    }
  }

  if (step === 'scan') {
    return <BarcodeScanner onDetected={handleDetected} onClose={onClose} />;
  }

  return (
    <div className="sf-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Scanned food">
      <div className="sf-sheet" onClick={e => e.stopPropagation()}>
        <span className="sf-grab" aria-hidden="true" />

        {step === 'lookup' && (
          <div className="sf-loading">
            <span className="sf-spinner" aria-hidden="true" />
            <p>Looking up {formatBarcode(code)}…</p>
          </div>
        )}

        {step === 'existing' && existing && (
          <>
            <span className="sf-badge">✓ Already in your foods</span>
            <div className="sf-found">
              <span className="sf-emoji">{existing.emoji || '🍽️'}</span>
              <div>
                <strong>{existing.name}</strong>
                <span>{existing.serving_description} · {existing.calories} kcal</span>
              </div>
            </div>
            {existingWarning && <p className="sf-warning">⚠ {existingWarning}</p>}
            <div className="sf-actions">
              <button className="btn-primary" onClick={() => onLogExisting(existing)}>
                {existingWarning ? 'Log anyway' : 'Log 1 serving'}
              </button>
              <button className="sf-secondary" onClick={() => setStep('scan')}>Scan another</button>
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            {!source
              ? <span className="sf-badge sf-badge--miss">Not found</span>
              : notice
                ? <span className="sf-badge sf-badge--miss">Found, needs macros</span>
                : <span className="sf-badge">✓ Found it</span>}
            {notice && <p className="sf-notice">{notice}</p>}

            <div className="sf-found">
              <span className="sf-emoji">{guessEmoji(form.name)}</span>
              <div className="sf-name-wrap">
                <input
                  id="scan-name"
                  className="sf-name"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Food name"
                  aria-label="Food name"
                  autoFocus={!source}
                />
                <span>Barcode {formatBarcode(code)}</span>
              </div>
            </div>

            <Field id="scan-serving" label="Serving" auto={autoFilled.has('serving_description')}
              value={form.serving_description} onChange={v => setField('serving_description', v)} placeholder="e.g. 2 tbsp (32 g)" />

            <div className="sf-grid">
              <Field id="scan-cal" label="Calories" numeric auto={autoFilled.has('calories')} value={form.calories} onChange={v => setField('calories', v)} placeholder="kcal" />
              <Field id="scan-fat" label="Fat (g)" numeric auto={autoFilled.has('fat_g')} value={form.fat_g} onChange={v => setField('fat_g', v)} placeholder="g" />
              <Field id="scan-protein" label="Protein (g)" numeric auto={autoFilled.has('protein_g')} value={form.protein_g} onChange={v => setField('protein_g', v)} placeholder="g" />
              <Field id="scan-carbs" label="Total carbs (g)" numeric auto={autoFilled.has('total_carbs_g')} value={form.total_carbs_g} onChange={v => setField('total_carbs_g', v)} placeholder="g" />
              <Field id="scan-fiber" label="Fiber (g)" numeric auto={autoFilled.has('fiber_g')} value={form.fiber_g} onChange={v => setField('fiber_g', v)} placeholder="g" />
              <div className="sf-net">
                <span>Net carbs</span>
                <strong>{netCarbs === null ? '—' : `${netCarbs} g`}</strong>
              </div>
            </div>

            {error && <p className="error-msg">{error}</p>}
            {formWarning && <p className="sf-warning">⚠ {formWarning}</p>}

            <div className="sf-actions">
              <button className="btn-primary" onClick={() => save(true)} disabled={saving}>
                {saving ? 'Saving…' : formWarning ? 'Save & log anyway' : 'Save & log 1 serving'}
              </button>
              <button className="sf-secondary" onClick={() => save(false)} disabled={saving}>Save to my foods</button>
            </div>
            {source && <p className="sf-source">Data from {source}. Check it against the label.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, numeric, auto }) {
  return (
    <div className="sf-field">
      <label htmlFor={id}>
        {label}
        {auto && <span className="auto-badge">Auto</span>}
      </label>
      <input
        id={id}
        className="input sf-input"
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        min={numeric ? 0 : undefined}
        step={numeric ? 'any' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
