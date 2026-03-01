import { useState } from 'react';
import { presetsApi } from '../api/client';
import './PresetModal.css';

const EMOJI_OPTIONS = ['🍱', '🥗', '🍳', '🥓', '🥩', '🐟', '🍗', '🧀', '🥑', '🥦', '🌰', '🥛', '🫒', '🥚', '🌮'];

function MacroPreview({ items }) {
  const totals = items.reduce((acc, item) => ({
    calories: acc.calories + item.calories * item.servings,
    fat_g: acc.fat_g + item.fat_g * item.servings,
    protein_g: acc.protein_g + item.protein_g * item.servings,
    carbs_g: acc.carbs_g + item.carbs_g * item.servings,
  }), { calories: 0, fat_g: 0, protein_g: 0, carbs_g: 0 });

  return (
    <div className="pm-macro-preview">
      <span>{Math.round(totals.calories)} kcal</span>
      <span>·</span>
      <span>{Math.round(totals.fat_g)}g fat</span>
      <span>·</span>
      <span>{Math.round(totals.protein_g)}g prot</span>
      <span>·</span>
      <span>{Math.round(totals.carbs_g)}g carbs</span>
    </div>
  );
}

function CreateView({ foods, todayLogs, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍱');
  const [selected, setSelected] = useState({}); // { food_id: servings }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function importToday() {
    const map = {};
    for (const log of todayLogs) {
      map[log.food_id] = log.servings;
    }
    setSelected(map);
  }

  function toggleFood(food) {
    setSelected(prev => {
      if (prev[food.id]) {
        const next = { ...prev };
        delete next[food.id];
        return next;
      }
      return { ...prev, [food.id]: 1 };
    });
  }

  function changeServings(foodId, delta) {
    setSelected(prev => {
      const cur = prev[foodId] || 1;
      const next = cur + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[foodId];
        return copy;
      }
      return { ...prev, [foodId]: next };
    });
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    const items = Object.entries(selected).map(([food_id, servings]) => ({
      food_id: Number(food_id), servings,
    }));
    if (items.length === 0) { setError('Select at least one food'); return; }

    setSaving(true);
    try {
      const res = await presetsApi.create({ name: name.trim(), emoji, items });
      onSave(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = foods
    .filter(f => selected[f.id])
    .map(f => ({ ...f, servings: selected[f.id] }));

  return (
    <div className="pm-create">
      <div className="pm-create-header">
        <button className="pm-back-btn" onClick={onCancel}>← Back</button>
        <h3 className="pm-create-title">New Preset</h3>
        <button className="pm-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <div className="pm-error">{error}</div>}

      <div className="pm-field">
        <label className="pm-label">Name</label>
        <input
          className="pm-input"
          placeholder="e.g. Keto Breakfast"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={40}
        />
      </div>

      <div className="pm-field">
        <label className="pm-label">Emoji</label>
        <div className="pm-emoji-grid">
          {EMOJI_OPTIONS.map(e => (
            <button
              key={e}
              className={`pm-emoji-opt ${emoji === e ? 'pm-emoji-opt--active' : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {selectedItems.length > 0 && <MacroPreview items={selectedItems} />}

      <div className="pm-field">
        <div className="pm-foods-header">
          <label className="pm-label">Foods</label>
          {todayLogs.length > 0 && (
            <button className="pm-import-btn" onClick={importToday}>Import today</button>
          )}
        </div>
        <div className="pm-food-list">
          {foods.map(food => {
            const servings = selected[food.id] || 0;
            const isSelected = servings > 0;
            return (
              <div
                key={food.id}
                className={`pm-food-row ${isSelected ? 'pm-food-row--active' : ''}`}
              >
                <button
                  className="pm-food-check"
                  onClick={() => toggleFood(food)}
                >
                  <span className="pm-food-emoji">{food.emoji || '🍽️'}</span>
                  <span className="pm-food-name">{food.name}</span>
                  <span className="pm-food-cal">{food.calories} kcal</span>
                </button>
                {isSelected && (
                  <div className="pm-serving-ctrl">
                    <button className="pm-srv-btn" onClick={() => changeServings(food.id, -1)}>−</button>
                    <span className="pm-srv-count">×{servings}</span>
                    <button className="pm-srv-btn" onClick={() => changeServings(food.id, 1)}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ManageView({ presets, onAdd, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(null);

  async function handleDelete(preset) {
    setDeleting(preset.id);
    try {
      await presetsApi.delete(preset.id);
      onDelete(preset.id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="pm-manage">
      <div className="pm-manage-header">
        <h3 className="pm-manage-title">Presets</h3>
        <button className="pm-close-btn" onClick={onClose}>✕</button>
      </div>

      {presets.length === 0 ? (
        <p className="pm-no-presets">No presets yet. Create one to log multiple foods at once.</p>
      ) : (
        <div className="pm-preset-list">
          {presets.map(preset => {
            const totalCal = preset.items.reduce(
              (s, i) => s + i.calories * i.servings, 0
            );
            return (
              <div key={preset.id} className="pm-preset-item">
                <div className="pm-preset-item-left">
                  <span className="pm-preset-item-emoji">{preset.emoji}</span>
                  <div className="pm-preset-item-info">
                    <span className="pm-preset-item-name">{preset.name}</span>
                    <span className="pm-preset-item-detail">
                      {preset.items.length} food{preset.items.length !== 1 ? 's' : ''} · {Math.round(totalCal)} kcal
                    </span>
                    <div className="pm-preset-item-foods">
                      {preset.items.map(item => (
                        <span key={item.id} className="pm-preset-food-tag">
                          {item.food_emoji} {item.food_name}{item.servings > 1 ? ` ×${item.servings}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className="pm-delete-btn"
                  onClick={() => handleDelete(preset)}
                  disabled={deleting === preset.id}
                >
                  {deleting === preset.id ? '…' : '🗑'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className="pm-new-btn" onClick={onAdd}>+ New Preset</button>
    </div>
  );
}

export default function PresetModal({ isOpen, onClose, foods, todayLogs, presets, onPresetsChange }) {
  const [view, setView] = useState('manage'); // 'manage' | 'create'

  function handleSaved(newPreset) {
    onPresetsChange([newPreset, ...presets]);
    setView('manage');
  }

  function handleDeleted(id) {
    onPresetsChange(presets.filter(p => p.id !== id));
  }

  function handleClose() {
    setView('manage');
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="pm-overlay" onClick={handleClose}>
      <div className="pm-sheet" onClick={e => e.stopPropagation()}>
        {view === 'manage' ? (
          <ManageView
            presets={presets}
            onAdd={() => setView('create')}
            onDelete={handleDeleted}
            onClose={handleClose}
          />
        ) : (
          <CreateView
            foods={foods}
            todayLogs={todayLogs}
            onSave={handleSaved}
            onCancel={() => setView('manage')}
          />
        )}
      </div>
    </div>
  );
}
