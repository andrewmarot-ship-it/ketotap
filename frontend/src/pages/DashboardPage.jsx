import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { targetsApi, foodsApi, logsApi } from '../api/client';
import MacroBar from '../components/MacroBar';
import FoodGrid from '../components/FoodGrid';
import './DashboardPage.css';

function todayStr() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const [targets, setTargets] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDayCompleted, setIsDayCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  const today = todayStr();

  const loadData = useCallback(async () => {
    try {
      const [tRes, fRes, lRes, cRes] = await Promise.all([
        targetsApi.get(),
        foodsApi.list(),
        logsApi.getDay(today),
        logsApi.isCompleted(today),
      ]);
      setTargets(tRes.data);
      setFoods(fRes.data);
      setLogs(lRes.data);
      setIsDayCompleted(cRes.data.completed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute today's totals from logs
  const totals = logs.reduce((acc, log) => ({
    calories: acc.calories + log.calories * log.servings,
    fat_g: acc.fat_g + log.fat_g * log.servings,
    protein_g: acc.protein_g + log.protein_g * log.servings,
    carbs_g: acc.carbs_g + log.carbs_g * log.servings,
  }), { calories: 0, fat_g: 0, protein_g: 0, carbs_g: 0 });

  async function handleAdd(food) {
    try {
      await logsApi.add(food.id, today);
      const res = await logsApi.getDay(today);
      setLogs(res.data);
    } catch (e) {
      console.error('handleAdd failed', e.response?.status, e.response?.data, e);
    }
  }

  async function handleRemove(food) {
    // Read directly from `logs` — handleRemove is re-created on every
    // render so this closure always holds the current state.
    const log = logs.find(l => l.food_id === food.id);
    if (!log) return;

    // If the entry is still optimistic (hasn't been committed yet), skip
    if (String(log.id).startsWith('opt-')) return;

    try {
      await logsApi.remove(log.id);
      // Re-fetch to get authoritative counts after the removal
      const res = await logsApi.getDay(today);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCompleteDay() {
    setCompleting(true);
    try {
      const res = await logsApi.toggleComplete(today);
      setIsDayCompleted(res.data.completed);
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading) return <div className="dash-loading">Loading…</div>;

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-icon">🥑</span>
            <span className="dash-title">KetoTap</span>
          </div>
          <nav className="dash-nav">
            <Link to="/history" className="nav-link">History</Link>
            <Link to="/foods" className="nav-link">Foods</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            <button className="nav-logout" onClick={logout}>Logout</button>
          </nav>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-date">
          <span>{formatDate()}</span>
        </div>

        {targets && (
          <div className="macro-summary card">
            <div className="macro-row">
              <MacroBar
                label="Calories"
                current={Math.round(totals.calories)}
                target={targets.calories}
                unit="kcal"
                color="var(--primary)"
              />
            </div>
            <div className="macro-grid">
              <MacroBar
                label="Fat"
                current={Math.round(totals.fat_g)}
                target={targets.fat_g}
                unit="g"
                color="#F39C12"
                small
              />
              <MacroBar
                label="Protein"
                current={Math.round(totals.protein_g)}
                target={targets.protein_g}
                unit="g"
                color="#3498DB"
                small
              />
              <MacroBar
                label="Net Carbs"
                current={Math.round(totals.carbs_g)}
                target={targets.carbs_g}
                unit="g"
                color={totals.carbs_g > targets.carbs_g ? 'var(--over-limit)' : totals.carbs_g > targets.carbs_g * 0.8 ? 'var(--warning)' : 'var(--primary)'}
                small
              />
            </div>
          </div>
        )}

        <div className="dash-complete">
          <button
            className={`complete-btn ${isDayCompleted ? 'complete-btn--done' : ''}`}
            onClick={handleCompleteDay}
            disabled={completing}
          >
            {isDayCompleted ? '✓ Day Completed' : 'Complete Day'}
          </button>
        </div>

        <div className="dash-section-label">Tap + to log · − to remove</div>
        <FoodGrid
          foods={foods}
          logs={logs}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </main>
    </div>
  );
}
