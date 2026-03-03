import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { targetsApi } from '../api/client';
import BottomNav from '../components/BottomNav';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ calories: '', fat_g: '', protein_g: '', carbs_g: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    targetsApi.get()
      .then(r => setForm({
        calories: r.data.calories,
        fat_g: r.data.fat_g,
        protein_g: r.data.protein_g,
        carbs_g: r.data.carbs_g,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await targetsApi.update({
        calories: Number(form.calories),
        fat_g: Number(form.fat_g),
        protein_g: Number(form.protein_g),
        carbs_g: Number(form.carbs_g),
      });
      setSuccess('Targets saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Profile</h1>
        <button className="nav-logout" onClick={logout}>Logout</button>
      </header>

      <div className="profile-content">
        <div className="profile-card card">
          <div className="profile-avatar">⚡🥑</div>
          <div className="profile-email">{user?.email}</div>
        </div>

        <div className="card">
          <h2>Daily Macro Targets</h2>
          <p className="profile-subtitle">Set your keto targets once. They persist across days.</p>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave} className="targets-form">
              <div className="target-field">
                <label>Daily Calories</label>
                <div className="target-input-wrap">
                  <input
                    className="input"
                    type="number"
                    min="500"
                    max="5000"
                    value={form.calories}
                    onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
                    required
                  />
                  <span className="target-unit">kcal</span>
                </div>
              </div>

              <div className="target-row">
                <div className="target-field">
                  <label>Fat</label>
                  <div className="target-input-wrap">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={form.fat_g}
                      onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))}
                      required
                    />
                    <span className="target-unit">g</span>
                  </div>
                </div>
                <div className="target-field">
                  <label>Protein</label>
                  <div className="target-input-wrap">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={form.protein_g}
                      onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))}
                      required
                    />
                    <span className="target-unit">g</span>
                  </div>
                </div>
                <div className="target-field">
                  <label>Net Carbs</label>
                  <div className="target-input-wrap">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.carbs_g}
                      onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))}
                      required
                    />
                    <span className="target-unit">g</span>
                  </div>
                </div>
              </div>

              {error && <p className="error-msg">{error}</p>}
              {success && <p className="success-msg">{success}</p>}

              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Targets'}
              </button>
            </form>
          )}
        </div>

        <div className="card profile-tip">
          <h3>Keto Macro Guidelines</h3>
          <ul>
            <li>🥑 <strong>Fat:</strong> 70–75% of calories</li>
            <li>🥩 <strong>Protein:</strong> 20–25% of calories</li>
            <li>🥦 <strong>Net Carbs:</strong> Under 20–25g/day</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
