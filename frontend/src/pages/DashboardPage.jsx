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
  const { user, logout } = useAuth();
  const [targets, setTargets] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tapping, setTapping] = useState(null); // food id being tapped

  const today = todayStr();

  const loadData = useCallback(async () => {
    try {
      const [tRes, fRes, lRes] = await Promise.all([
        targetsApi.get(),
        foodsApi.list(),
        logsApi.getDay(today),
      ]);
      setTargets(tRes.data);
      setFoods(fRes.data);
      setLogs(lRes.data);
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

  async function handleTap(food) {
    setTapping(food.id);
    try {
      const res = await logsApi.add(food.id, today);
      const newLog = res.data;
      setLogs(prev => {
        const idx = prev.findIndex(l => l.food_id === food.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newLog;
          return updated;
        }
        return [...prev, newLog];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTapping(null);
    }
  }

  async function handleLongPress(food) {
    // Find log entry for this food
    const log = logs.find(l => l.food_id === food.id);
    if (!log) return;
    try {
      await logsApi.remove(log.id);
      // Re-fetch logs to get updated servings
      const res = await logsApi.getDay(today);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading) return <div className="dash-loading">Loading…</div>;

  return (
    <div className="dash-page">
      {/* Header */}
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
        {/* Date + greeting */}
        <div className="dash-date">
          <span>{formatDate()}</span>
        </div>

        {/* Macro Summary */}
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

        {/* Food Grid */}
        <div className="dash-section-label">Tap to log food</div>
        <FoodGrid
          foods={foods}
          logs={logs}
          onTap={handleTap}
          onLongPress={handleLongPress}
          tapping={tapping}
        />
      </main>
    </div>
  );
}
