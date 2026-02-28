import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Track the server-confirmed serving count per food so rapid taps
  // never show a stale lower count when responses arrive out of order.
  const serverCounts = useRef({});

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
      // Seed serverCounts from loaded logs
      serverCounts.current = {};
      for (const log of lRes.data) {
        serverCounts.current[log.food_id] = log.servings;
      }
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
    // 1. Optimistic: increment immediately so the UI feels instant
    setLogs(prev => {
      const idx = prev.findIndex(l => l.food_id === food.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], servings: updated[idx].servings + 1 };
        return updated;
      }
      // First serving — create a placeholder entry
      return [...prev, {
        id: `opt-${food.id}`,
        food_id: food.id,
        servings: 1,
        name: food.name,
        serving_description: food.serving_description,
        calories: food.calories,
        fat_g: food.fat_g,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        image_url: food.image_url,
        emoji: food.emoji,
      }];
    });

    try {
      const res = await logsApi.add(food.id, today);
      const serverLog = res.data;

      // Record the latest confirmed server count
      serverCounts.current[food.id] = serverLog.servings;

      // Sync: use whichever is higher (optimistic vs server) to handle out-of-order responses
      setLogs(prev => {
        const idx = prev.findIndex(l => l.food_id === food.id);
        if (idx < 0) return [...prev, serverLog];
        const updated = [...prev];
        const best = Math.max(serverLog.servings, serverCounts.current[food.id] || 0, updated[idx].servings);
        updated[idx] = { ...serverLog, servings: best };
        return updated;
      });
    } catch (e) {
      console.error(e);
      // On error revert to authoritative server state
      logsApi.getDay(today).then(r => setLogs(r.data)).catch(() => {});
    }
  }

  async function handleRemove(food) {
    // Find the current log entry by food_id using the functional updater
    // to avoid stale closure issues with the `logs` variable
    let logId = null;
    setLogs(prev => {
      const log = prev.find(l => l.food_id === food.id);
      if (log) logId = log.id;
      return prev; // no change yet
    });

    if (!logId || String(logId).startsWith('opt-')) {
      // Entry not committed to server yet — just re-fetch to sync
      logsApi.getDay(today).then(r => setLogs(r.data)).catch(() => {});
      return;
    }

    try {
      await logsApi.remove(logId);
      const res = await logsApi.getDay(today);
      setLogs(res.data);
      // Refresh serverCounts
      serverCounts.current = {};
      for (const log of res.data) {
        serverCounts.current[log.food_id] = log.servings;
      }
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
        {/* Date */}
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

        {/* Complete Day */}
        <div className="dash-complete">
          <button
            className={`complete-btn ${isDayCompleted ? 'complete-btn--done' : ''}`}
            onClick={handleCompleteDay}
            disabled={completing}
          >
            {isDayCompleted ? '✓ Day Completed' : 'Complete Day'}
          </button>
        </div>

        {/* Food Grid */}
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
