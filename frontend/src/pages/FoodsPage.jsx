import { useState, useEffect } from 'react';
import { foodsApi, nutritionApi } from '../api/client';
import BottomNav from '../components/BottomNav';
import './FoodsPage.css';

const EMPTY_FOOD = {
  name: '', serving_description: '', calories: '', fat_g: '', protein_g: '', carbs_g: '', emoji: '',
  nutrition_source: null, nutrition_source_id: null, nutrition_quantity_label: null,
  nutrition_auto_filled_at: null, nutrition_overridden: 0,
};

function guessEmoji(name) {
  if (!name) return '🍽️';
  const n = name.toLowerCase();
  const map = [
    [['olive oil', 'olive'],                                        '🫒'],
    [['coconut oil', 'coconut'],                                    '🥥'],
    [['butter', 'ghee'],                                            '🧈'],
    [['cream', 'milk'],                                             '🥛'],
    [['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia'], '🌰'],
    [['nut butter', 'almond butter', 'peanut butter', 'tahini'],   '🌰'],
    [['chia', 'hemp seed', 'flaxseed', 'flax seed', 'sunflower seed', 'pumpkin seed'], '🌱'],
    [['seed', 'seeds'],                                             '🌱'],
    [['chicken', 'turkey', 'duck', 'poultry'],                      '🍗'],
    [['shrimp', 'prawn', 'lobster', 'crab', 'scallop'],             '🍤'],
    [['salmon', 'tuna', 'fish', 'cod', 'halibut', 'sardine', 'mackerel', 'tilapia', 'trout'], '🐟'],
    [['beef', 'steak', 'ground beef', 'brisket', 'ribeye', 'lamb', 'venison'], '🥩'],
    [['bacon', 'pork', 'ham', 'sausage', 'pepperoni', 'salami', 'prosciutto'], '🥓'],
    [['egg'],                                                       '🥚'],
    [['cheese', 'feta', 'mozzarella', 'cheddar', 'brie', 'parmesan', 'gouda', 'marble'], '🧀'],
    [['yogurt', 'yoghurt'],                                         '🍶'],
    [['avocado'],                                                   '🥑'],
    [['broccoli'],                                                  '🥦'],
    [['pepper', 'capsicum', 'jalapeño', 'jalapeno', 'chili'],       '🫑'],
    [['zucchini', 'courgette', 'cucumber'],                         '🥒'],
    [['chocolate', 'cocoa', 'cacao'],                               '🍫'],
    [['coffee', 'espresso', 'latte', 'cappuccino'],                 '☕'],
    [['tea', 'matcha'],                                             '🍵'],
    [['water', 'sparkling water'],                                  '💧'],
    [['bread', 'toast', 'sourdough', 'bagel', 'pita'],              '🍞'],
    [['rice', 'quinoa', 'couscous'],                                '🫙'],
    [['oat', 'granola', 'cereal', 'muesli'],                        '🌾'],
    [['pasta', 'noodle', 'spaghetti', 'linguine', 'fettuccine'],    '🍝'],
    [['soup', 'broth', 'stock', 'bone broth'],                      '🍲'],
    [['salad', 'lettuce', 'spinach', 'kale', 'arugula', 'mixed greens'], '🥗'],
    [['tomato'],                                                    '🍅'],
    [['lemon', 'lime'],                                             '🍋'],
    [['orange', 'mandarin', 'tangerine', 'grapefruit'],             '🍊'],
    [['strawberry', 'blueberry', 'raspberry', 'blackberry', 'berry'], '🍓'],
    [['apple'],                                                     '🍎'],
    [['banana'],                                                    '🍌'],
    [['mushroom'],                                                  '🍄'],
    [['onion', 'shallot', 'leek', 'garlic'],                        '🧅'],
    [['protein powder', 'whey', 'protein shake', 'creatine', 'supplement'], '💪'],
    [['oil', 'vinegar', 'sauce', 'dressing', 'mayo', 'mustard', 'ketchup'], '🫙'],
  ];
  for (const [keywords, emoji] of map) {
    if (keywords.some(k => n.includes(k))) return emoji;
  }
  return '🍽️';
}

export default function FoodsPage() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // food object or null
  const [form, setForm] = useState(EMPTY_FOOD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState('');
  const [nutritionMeta, setNutritionMeta] = useState(null);

  useEffect(() => {
    foodsApi.list()
      .then(r => setFoods(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditing('new');
    setForm(EMPTY_FOOD);
    setError('');
  }

  function openEdit(food) {
    setEditing(food);
    setForm({
      name: food.name,
      serving_description: food.serving_description,
      calories: food.calories,
      fat_g: food.fat_g,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      emoji: food.emoji || '🍽️',
    });
    setError('');
  }

  function closeForm() {
    setEditing(null);
    setForm(EMPTY_FOOD);
    setError('');
    setAutoFilled(new Set());
    setAutoFillError('');
    setNutritionMeta(null);
  }

  async function handleAutoFillNutrition() {
    setAutoFillError('');
    setAutoFilling(true);
    try {
      const res = await nutritionApi.lookup(form.name, form.serving_description);
      const d = res.data;
      setForm(f => ({ ...f, calories: d.calories, fat_g: d.fat_g, protein_g: d.protein_g, carbs_g: d.carbs_g }));
      setAutoFilled(new Set(['calories', 'fat_g', 'protein_g', 'carbs_g']));
      setNutritionMeta({ fdc_id: d.fdc_id, food_name: d.food_name, quantity_label: d.quantity_label });
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'food_not_found') {
        setAutoFillError('Could not find nutrition data for this food. Enter values manually.');
      } else if (code === 'quantity_parse_error') {
        setAutoFillError('Could not understand the serving description. Try a format like "1 tbsp" or "100g".');
      } else {
        setAutoFillError('Auto-fill unavailable right now. Enter values manually.');
      }
    } finally {
      setAutoFilling(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        calories: Number(form.calories),
        fat_g: Number(form.fat_g),
        protein_g: Number(form.protein_g),
        carbs_g: Number(form.carbs_g),
        emoji: form.emoji || guessEmoji(form.name),
        nutrition_source: nutritionMeta ? 'USDA_FDC' : null,
        nutrition_source_id: nutritionMeta?.fdc_id?.toString() ?? null,
        nutrition_quantity_label: nutritionMeta?.quantity_label ?? null,
        nutrition_auto_filled_at: nutritionMeta ? new Date().toISOString() : null,
        nutrition_overridden: nutritionMeta && autoFilled.size < 4 ? 1 : 0,
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

  async function handleDelete(food) {
    try {
      await foodsApi.delete(food.id);
      setFoods(prev => prev.filter(f => f.id !== food.id));
      setDeleteConfirm(null);
    } catch {
      alert('Failed to delete food');
    }
  }

  return (
    <div className="foods-page">
      <header className="foods-header">
        <h1>Food Inventory</h1>
        <button className="btn-add" onClick={openNew}>+ Add Food</button>
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
                <span className="food-row-serving">{food.serving_description}</span>
                <div className="food-row-macros">
                  <span>{food.calories} kcal</span>
                  <span>{food.fat_g}g fat</span>
                  <span>{food.protein_g}g protein</span>
                  <span>{food.carbs_g}g carbs</span>
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
              <div className="field">
                <label>Serving Description *</label>
                <input className="input" value={form.serving_description} onChange={e => setForm(f => ({ ...f, serving_description: e.target.value }))} placeholder="e.g. 1 whole (200g)" required />
              </div>

              {form.name && form.serving_description && (
                <div className="autofill-row">
                  <button
                    type="button"
                    className="btn-autofill"
                    onClick={handleAutoFillNutrition}
                    disabled={autoFilling}
                  >
                    {autoFilling ? <><span className="autofill-spinner" /> Looking up…</> : '✨ Auto-fill Nutrition'}
                  </button>
                  {autoFillError && <p className="autofill-error">{autoFillError}</p>}
                </div>
              )}

              <div className="field-row">
                <div className="field">
                  <label>
                    Calories *
                    {autoFilled.has('calories') && <span className="auto-badge">Auto</span>}
                  </label>
                  <input className="input" type="number" min="0" value={form.calories}
                    onChange={e => {
                      setForm(f => ({ ...f, calories: e.target.value }));
                      setAutoFilled(prev => { const s = new Set(prev); s.delete('calories'); return s; });
                    }}
                    placeholder="kcal" required />
                </div>
                <div className="field">
                  <label>
                    Net Carbs (g) *
                    {autoFilled.has('carbs_g') && <span className="auto-badge">Auto</span>}
                  </label>
                  <input className="input" type="number" min="0" step="0.1" value={form.carbs_g}
                    onChange={e => {
                      setForm(f => ({ ...f, carbs_g: e.target.value }));
                      setAutoFilled(prev => { const s = new Set(prev); s.delete('carbs_g'); return s; });
                    }}
                    placeholder="g" required />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>
                    Fat (g) *
                    {autoFilled.has('fat_g') && <span className="auto-badge">Auto</span>}
                  </label>
                  <input className="input" type="number" min="0" step="0.1" value={form.fat_g}
                    onChange={e => {
                      setForm(f => ({ ...f, fat_g: e.target.value }));
                      setAutoFilled(prev => { const s = new Set(prev); s.delete('fat_g'); return s; });
                    }}
                    placeholder="g" required />
                </div>
                <div className="field">
                  <label>
                    Protein (g) *
                    {autoFilled.has('protein_g') && <span className="auto-badge">Auto</span>}
                  </label>
                  <input className="input" type="number" min="0" step="0.1" value={form.protein_g}
                    onChange={e => {
                      setForm(f => ({ ...f, protein_g: e.target.value }));
                      setAutoFilled(prev => { const s = new Set(prev); s.delete('protein_g'); return s; });
                    }}
                    placeholder="g" required />
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

      <BottomNav />
    </div>
  );
}
