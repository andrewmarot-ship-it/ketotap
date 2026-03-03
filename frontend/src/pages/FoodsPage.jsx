import { useState, useEffect } from 'react';
import { foodsApi } from '../api/client';
import BottomNav from '../components/BottomNav';
import './FoodsPage.css';

const EMPTY_FOOD = { name: '', serving_description: '', calories: '', fat_g: '', protein_g: '', carbs_g: '', image_url: '' };

// Attempt auto image lookup via Unsplash source (no API key needed)
function guessImageUrl(name) {
  if (!name) return '';
  const query = encodeURIComponent(name.toLowerCase());
  return `https://source.unsplash.com/200x200/?${query},food`;
}

export default function FoodsPage() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // food object or null
  const [form, setForm] = useState(EMPTY_FOOD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      image_url: food.image_url || '',
    });
    setError('');
  }

  function closeForm() {
    setEditing(null);
    setForm(EMPTY_FOOD);
    setError('');
  }

  async function handleAutoImage() {
    const url = guessImageUrl(form.name);
    setForm(f => ({ ...f, image_url: url }));
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
                {food.image_url
                  ? <img src={food.image_url} alt={food.name} onError={e => e.target.style.display='none'} />
                  : <span>🍽️</span>
                }
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
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Avocado" required />
              </div>
              <div className="field">
                <label>Serving Description *</label>
                <input className="input" value={form.serving_description} onChange={e => setForm(f => ({ ...f, serving_description: e.target.value }))} placeholder="e.g. 1 whole (200g)" required />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Calories *</label>
                  <input className="input" type="number" min="0" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} placeholder="kcal" required />
                </div>
                <div className="field">
                  <label>Net Carbs (g) *</label>
                  <input className="input" type="number" min="0" step="0.1" value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} placeholder="g" required />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Fat (g) *</label>
                  <input className="input" type="number" min="0" step="0.1" value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} placeholder="g" required />
                </div>
                <div className="field">
                  <label>Protein (g) *</label>
                  <input className="input" type="number" min="0" step="0.1" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} placeholder="g" required />
                </div>
              </div>

              <div className="field">
                <label>Image URL</label>
                <div className="image-row">
                  <input className="input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" />
                  <button type="button" className="btn-auto-img" onClick={handleAutoImage} disabled={!form.name}>
                    Auto
                  </button>
                </div>
                {form.image_url && (
                  <img src={form.image_url} alt="preview" className="img-preview" onError={e => e.target.style.display='none'} />
                )}
              </div>

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
