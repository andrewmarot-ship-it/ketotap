import { useState, useEffect } from 'react';
import { foodsApi, nutritionApi, logsApi } from '../api/client';
import BottomNav from '../components/BottomNav';
import ScanFlow from '../components/ScanFlow';
import BarcodeIcon from '../components/BarcodeIcon';
import { guessEmoji } from '../utils/emoji';
import './FoodsPage.css';

const EMPTY_FOOD = {
  name: '', serving_description: '', calories: '', fat_g: '', protein_g: '', total_carbs_g: '', fiber_g: '', emoji: '',
  nutrition_source: null, nutrition_source_id: null, nutrition_quantity_label: null,
  nutrition_auto_filled_at: null, nutrition_overridden: 0,
};

const r1 = v => Math.round(v * 10) / 10;

function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}

export default function FoodsPage() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FOOD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState('');

  // Nutrition auto-fill state
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [nutritionMeta, setNutritionMeta] = useState(null);

  // v2 portion-picker state
  const [portionsLoading, setPortionsLoading] = useState(false);
  const [portionsData, setPortionsData] = useState(null);   // null | API response
  const [selectedPortion, setSelectedPortion] = useState(null); // null | { label, gram_weight }
  const [portionsError, setPortionsError] = useState('');

  useEffect(() => {
    foodsApi.list()
      .then(r => setFoods([...r.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function resetPortionState() {
    setPortionsLoading(false);
    setPortionsData(null);
    setSelectedPortion(null);
    setPortionsError('');
    setAutoFilled(new Set());
    setNutritionMeta(null);
  }

  function openNew() {
    setEditing('new');
    setForm(EMPTY_FOOD);
    setError('');
    resetPortionState();
  }

  function openEdit(food) {
    setEditing(food);
    setForm({
      name: food.name,
      serving_description: food.serving_description,
      calories: food.calories,
      fat_g: food.fat_g,
      protein_g: food.protein_g,
      total_carbs_g: r1(food.carbs_g + (food.fiber_g || 0)),
      fiber_g: food.fiber_g || 0,
      emoji: food.emoji || '🍽️',
    });
    setError('');
    resetPortionState();
  }

  function closeForm() {
    setEditing(null);
    setForm(EMPTY_FOOD);
    setError('');
    resetPortionState();
  }

  async function handleFindPortions() {
    setPortionsError('');
    setPortionsData(null);
    setSelectedPortion(null);
    setAutoFilled(new Set());
    setPortionsLoading(true);
    try {
      const res = await nutritionApi.portions(form.name);
      setPortionsData(res.data);
    } catch (err) {
      const code = err.response?.data?.error;
      setPortionsError(
        code === 'food_not_found'
          ? `No portions found for "${form.name}". Enter macros manually.`
          : 'Could not reach nutrition service. Enter macros manually.'
      );
    } finally {
      setPortionsLoading(false);
    }
  }

  function handleSelectPortion(portion) {
    const { per_100g } = portionsData;
    const scale = portion.gram_weight / 100;
    const r = v => Math.round(v * 10) / 10;
    setForm(f => ({
      ...f,
      calories:  r(per_100g.calories  * scale),
      fat_g:     r(per_100g.fat_g     * scale),
      protein_g: r(per_100g.protein_g * scale),
      total_carbs_g: r(per_100g.carbs_g * scale),
      fiber_g:   r((per_100g.fiber_g ?? 0) * scale),
    }));
    setSelectedPortion(portion);
    setAutoFilled(new Set(['calories', 'fat_g', 'protein_g', 'total_carbs_g', 'fiber_g']));
    setNutritionMeta({
      fdc_id: portionsData.fdc_id,
      food_name: portionsData.food_name,
      quantity_label: `${portion.label} (${portion.gram_weight}g)`,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { total_carbs_g, fiber_g, ...rest } = form;
      const fiber = Number(fiber_g) || 0;
      const payload = {
        ...rest,
        calories:  Number(form.calories),
        fat_g:     Number(form.fat_g),
        protein_g: Number(form.protein_g),
        carbs_g:   Math.max(0, r1(Number(total_carbs_g) - fiber)),
        fiber_g:   fiber,
        emoji: form.emoji || guessEmoji(form.name),
        nutrition_source:         nutritionMeta ? 'USDA_FDC' : null,
        nutrition_source_id:      nutritionMeta?.fdc_id?.toString() ?? null,
        nutrition_quantity_label: nutritionMeta?.quantity_label ?? null,
        nutrition_auto_filled_at: nutritionMeta ? new Date().toISOString() : null,
        nutrition_overridden:     nutritionMeta && autoFilled.size < 5 ? 1 : 0,
      };
      if (editing === 'new') {
        const res = await foodsApi.create(payload);
        setFoods(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const res = await foodsApi.update(editing.id, payload);
        setFoods(prev => prev.map(f => f.id === res.data.id ? res.data : f));
      }
      closeForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 3500);
  }

  async function handleScanSave(food, andLog) {
    setFoods(prev => [...prev, food].sort((a, b) => a.name.localeCompare(b.name)));
    setScanning(false);
    if (andLog) {
      try {
        await logsApi.add(food.id, todayStr(), 1);
        flash(`Saved ${food.name} and logged 1 serving for today`);
      } catch {
        flash(`Saved ${food.name}, but couldn't log it. Log it from Home.`);
      }
    } else {
      flash(`Saved ${food.name}`);
    }
  }

  async function handleScanLog(food) {
    setScanning(false);
    try {
      await logsApi.add(food.id, todayStr(), 1);
      flash(`Logged 1 serving of ${food.name} for today`);
    } catch {
      flash(`Couldn't log ${food.name}. Try again from Home.`);
    }
  }

  async function handleDelete(food) {
    try {
      await foodsApi.delete(food.id);
      setFoods(prev => prev.filter(f => f.id !== food.id));
      setDeleteConfirm(null);
    } catch {
      alert('Failed to delete food');
    }
  }

  const formTotal = parseFloat(form.total_carbs_g);
  const formNetCarbs = Number.isFinite(formTotal)
    ? Math.max(0, r1(formTotal - (parseFloat(form.fiber_g) || 0)))
    : null;
  const fieldProps = {
    form,
    autoFilled,
    onChange: (field, value) => {
      setForm(f => ({ ...f, [field]: value }));
      setAutoFilled(prev => { const next = new Set(prev); next.delete(field); return next; });
    },
  };

  return (
    <div className="foods-page">
      <header className="page-header">
        <div className="page-header-inner">
          <div className="page-heading">
            <span className="section-label">⚡🥑 KetoTap</span>
            <h1 className="page-title">Food Inventory</h1>
          </div>
          <div className="foods-header-actions">
            <button className="btn-scan" onClick={() => setScanning(true)}>
              <BarcodeIcon /> Scan
            </button>
            <button className="btn-add" onClick={openNew}>+ Add Food</button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="foods-loading">Loading…</div>
      ) : (
        <div className="foods-list">
          {foods.map(food => (
            <div key={food.id} className="food-row card">
              <div className="food-row-img">
                <span>{food.emoji || '🍽️'}</span>
              </div>
              <div className="food-row-info">
                <span className="food-row-name">{food.name}</span>
                <span className="food-row-serving">
                  {food.serving_description}
                  {food.barcode && <span className="food-row-scanned" title={`Barcode ${food.barcode}`}> · <BarcodeIcon size={11} /> scanned</span>}
                </span>
                <div className="food-row-macros">
                  <span className="m-cal">{food.calories} kcal</span>
                  <span className="m-fat">{food.fat_g}g fat</span>
                  <span className="m-protein">{food.protein_g}g protein</span>
                  <span className="m-carbs">{food.carbs_g}g net carbs</span>
                </div>
              </div>
              <div className="food-row-actions">
                <button className="btn-edit" onClick={() => openEdit(food)}>Edit</button>
                <button className="btn-danger" onClick={() => setDeleteConfirm(food)}>Del</button>
              </div>
            </div>
          ))}
          {foods.length === 0 && (
            <p className="foods-empty">No foods yet. Tap "+ Add Food" to get started.</p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <h2>{editing === 'new' ? 'Add Food' : 'Edit Food'}</h2>
            <form onSubmit={handleSave} className="food-form">

              {/* Name */}
              <div className="field">
                <label>Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({ ...f, name, emoji: guessEmoji(name) }));
                  }}
                  placeholder="e.g. Avocado"
                  required
                />
              </div>

              {/* Portion picker — visible when a name is typed */}
              {form.name && (
                <div className="portion-row">
                  {/* "Find Portions" button — shown until portions are loaded */}
                  {!portionsData && (
                    <button
                      type="button"
                      className="btn-autofill"
                      onClick={handleFindPortions}
                      disabled={portionsLoading}
                    >
                      {portionsLoading
                        ? <><span className="autofill-spinner" /> Finding portions…</>
                        : '🔍 Find Portions'}
                    </button>
                  )}

                  {/* Error */}
                  {portionsError && <p className="autofill-error">{portionsError}</p>}

                  {/* Portion chips */}
                  {portionsData && (
                    <div className="portion-picker">
                      <p className="portion-label-text">{portionsData.food_name}</p>
                      <div className="portion-chips">
                        {portionsData.portions.map(p => {
                          const isSelected =
                            selectedPortion?.label === p.label &&
                            selectedPortion?.gram_weight === p.gram_weight;
                          return (
                            <button
                              key={`${p.label}-${p.gram_weight}`}
                              type="button"
                              className={`portion-chip${isSelected ? ' portion-chip--selected' : ''}`}
                              onClick={() => handleSelectPortion(p)}
                            >
                              {p.label}
                              <span className="portion-chip-grams">({p.gram_weight}g)</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="btn-portions-reset"
                        onClick={handleFindPortions}
                      >
                        ↺ Search again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Serving Description */}
              <div className="field">
                <label>Serving Description *</label>
                <input
                  className="input"
                  value={form.serving_description}
                  onChange={e => setForm(f => ({ ...f, serving_description: e.target.value }))}
                  placeholder="e.g. 1 whole (200g)"
                  required
                />
              </div>

              {/* Macros */}
              <div className="field-row">
                <MacroInput id="food-cal" label="Calories" field="calories" step="1" placeholder="kcal" {...fieldProps} />
                <MacroInput id="food-fat" label="Fat (g)" field="fat_g" {...fieldProps} />
              </div>
              <div className="field-row">
                <MacroInput id="food-protein" label="Protein (g)" field="protein_g" {...fieldProps} />
                <MacroInput id="food-carbs" label="Total carbs (g)" field="total_carbs_g" {...fieldProps} />
              </div>
              <div className="field-row">
                <MacroInput id="food-fiber" label="Fiber (g)" field="fiber_g" required={false} placeholder="0" {...fieldProps} />
                <div className="net-carbs-box" aria-live="polite">
                  <span>Net carbs</span>
                  <strong>{formNetCarbs === null ? '—' : `${formNetCarbs} g`}</strong>
                </div>
              </div>

              {autoFilled.size > 0 && (
                <p className="nutrition-source">Data from USDA FoodData Central</p>
              )}

              {error && <p className="error-msg">{error}</p>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <h2>Delete Food</h2>
            <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <ScanFlow
          foods={foods}
          onSave={handleScanSave}
          onLogExisting={handleScanLog}
          onClose={() => setScanning(false)}
        />
      )}

      {notice && <div className="foods-toast" role="status">{notice}</div>}

      <BottomNav />
    </div>
  );
}

function MacroInput({ id, label, field, form, autoFilled, onChange, step = '0.1', placeholder = 'g', required = true }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}{required ? ' *' : ''}
        {autoFilled.has(field) && <span className="auto-badge">Auto</span>}
      </label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={form[field]}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
