import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { targetsApi, foodsApi, logsApi, presetsApi, intakeApi } from '../api/client';
import IntakeRow from '../components/IntakeRow';
import CompactMacroBar from '../components/CompactMacroBar';
import ScanFlow from '../components/ScanFlow';
import BarcodeIcon from '../components/BarcodeIcon';
import MacroChip from '../components/MacroChip';
import { ketoScore } from '../utils/macroCalculator';
import { computeTotals, computeAlerts, computeBlocked, computeRecommended, suggestFoodForGoal, limitWarning } from '../utils/macroStatus';
import MacroBanner from '../components/MacroBanner';
import FoodGrid from '../components/FoodGrid';
import PresetsRow from '../components/PresetsRow';
import PresetModal from '../components/PresetModal';
import PortionPickerSheet from '../components/PortionPickerSheet';
import BottomNav from '../components/BottomNav';
import './DashboardPage.css';

function todayStr() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

const TIP_KEY = 'kt_tip_foods_dismissed';

function readTipDismissed() {
  try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return false; }
}

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'logged',  label: 'Logged' },
  { key: 'fat',     label: 'High fat' },
  { key: 'protein', label: 'High protein' },
];

// Share of a food's calories coming from one macro (fat 9 kcal/g, protein 4 kcal/g)
function calorieShare(food, grams, kcalPerGram) {
  return food.calories > 0 ? (grams * kcalPerGram) / food.calories : 0;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function scoreTone(score) {
  if (score === null) return 'none';
  if (score >= 80) return 'good';
  if (score >= 50) return 'fair';
  return 'low';
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const [targets, setTargets] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDayCompleted, setIsDayCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [presets, setPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [intake, setIntake] = useState({ water: 0, sodium: 0, potassium: 0, magnesium: 0 });
  const [tipDismissed, setTipDismissed] = useState(readTipDismissed);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  // Full rings scroll away with the page; a compact bar takes over once they're out of view
  const [ringsEl, setRingsEl] = useState(null);
  const [ringsOutOfView, setRingsOutOfView] = useState(false);
  useEffect(() => {
    if (!ringsEl) return;
    const observer = new IntersectionObserver(([entry]) => {
      setRingsOutOfView(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(ringsEl);
    return () => observer.disconnect();
  }, [ringsEl]);

  // Portion Picker state
  const [pickerFood, setPickerFood] = useState(null); // food to show in picker
  const [pickerLog,  setPickerLog]  = useState(null); // null = add mode, log = edit mode

  const [viewDate, setViewDate] = useState(todayStr);
  const today = todayStr();

  const loadData = useCallback(async () => {
    try {
      const [tRes, fRes, lRes, cRes, pRes, iRes] = await Promise.all([
        targetsApi.get(),
        foodsApi.list(),
        logsApi.getDay(viewDate),
        logsApi.isCompleted(viewDate),
        presetsApi.list(),
        intakeApi.getDay(viewDate),
      ]);
      setTargets(tRes.data);
      setIntake(iRes.data);
      setFoods([...fRes.data].sort((a, b) => a.name.localeCompare(b.name)));
      setLogs(lRes.data);
      setIsDayCompleted(cRes.data.completed);
      setPresets(pRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = computeTotals(logs);
  const alerts = computeAlerts(totals, targets);
  const alertKeys = new Set(alerts.map(a => a.key));
  const blocked = computeBlocked(foods, totals, targets);
  const recommendedIds = computeRecommended(foods, totals, targets, blocked);

  // Opens the Portion Picker for a fresh add, or increments servings if already logged
  async function handleAdd(food) {
    if (blocked.has(food.id)) return;
    const existing = logs.find(l => l.food_id === food.id);
    if (existing) {
      try {
        await logsApi.add(food.id, viewDate, existing.portion_multiplier ?? 1);
        const res = await logsApi.getDay(viewDate);
        setLogs(res.data);
      } catch (e) {
        console.error('handleAdd failed', e);
      }
      return;
    }
    setPickerFood(food);
    setPickerLog(null);
  }

  // Opens the Portion Picker in edit mode (tap emoji on logged tile)
  function handleEdit(food) {
    const log = logs.find(l => l.food_id === food.id);
    if (!log) return;
    setPickerFood(food);
    setPickerLog(log);
  }

  // Called when user confirms a multiplier in the Portion Picker
  async function handlePickerConfirm(multiplier) {
    const food = pickerFood;
    const log  = pickerLog;
    setPickerFood(null);
    setPickerLog(null);

    try {
      if (log) {
        await logsApi.updateMultiplier(log.id, multiplier);
      } else {
        await logsApi.add(food.id, viewDate, multiplier);
      }
      const res = await logsApi.getDay(viewDate);
      setLogs(res.data);
    } catch (e) {
      console.error('handlePickerConfirm failed', e.response?.status, e.response?.data, e);
    }
  }

  function handlePickerDismiss() {
    setPickerFood(null);
    setPickerLog(null);
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
      const res = await logsApi.getDay(viewDate);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePresetLog(preset) {
    try {
      await presetsApi.log(preset.id, viewDate);
      const res = await logsApi.getDay(viewDate);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePresetRemove(preset) {
    try {
      const removals = preset.items
        .map(item => logs.find(l => l.food_id === item.food_id))
        .filter(log => log && !String(log.id).startsWith('opt-'));
      if (removals.length === 0) return;
      await Promise.all(removals.map(log => logsApi.remove(log.id)));
      const res = await logsApi.getDay(viewDate);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  // Scanned foods log one serving; if already logged today, keep that entry's portion size
  async function logOneServing(food) {
    const existing = logs.find(l => l.food_id === food.id);
    await logsApi.add(food.id, viewDate, existing?.portion_multiplier ?? 1);
    const res = await logsApi.getDay(viewDate);
    setLogs(res.data);
  }

  async function handleScanSave(food, andLog) {
    setFoods(prev => [...prev, food].sort((a, b) => a.name.localeCompare(b.name)));
    setScanning(false);
    if (andLog) {
      try { await logOneServing(food); } catch (e) { console.error('scan log failed', e); }
    }
  }

  async function handleScanLog(food) {
    setScanning(false);
    try { await logOneServing(food); } catch (e) { console.error('scan log failed', e); }
  }

  async function handleIntakeAdd(kind) {
    try {
      const res = await intakeApi.add(kind, viewDate);
      setIntake(res.data);
    } catch (e) {
      console.error('intake add failed', e);
    }
  }

  async function handleIntakeUndo(kind) {
    try {
      const res = await intakeApi.undo(kind, viewDate);
      setIntake(res.data);
    } catch (e) {
      console.error('intake undo failed', e);
    }
  }

  async function handleClearAll() {
    if (logs.length === 0) return;
    try {
      await logsApi.clearDay(viewDate);
      setLogs([]);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCompleteDay() {
    setCompleting(true);
    try {
      const res = await logsApi.toggleComplete(viewDate);
      setIsDayCompleted(res.data.completed);
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  }

  function dismissTip() {
    setTipDismissed(true);
    try { localStorage.setItem(TIP_KEY, '1'); } catch { /* storage unavailable */ }
  }

  const loggedIds = new Set(logs.map(l => l.food_id));
  const q = query.trim().toLowerCase();
  const visibleFoods = foods.filter(f => {
    if (q && !f.name.toLowerCase().includes(q)) return false;
    if (filter === 'logged')  return loggedIds.has(f.id);
    if (filter === 'fat')     return calorieShare(f, f.fat_g, 9) >= 0.6;
    if (filter === 'protein') return calorieShare(f, f.protein_g, 4) >= 0.4;
    return true;
  });

  const carbsOver = targets && totals.carbs_g > targets.carbs_g;
  const macros = targets ? [
    { key: 'fat',      label: 'Fat',       short: 'Fat',   emoji: '🧈', current: Math.round(totals.fat_g),     target: targets.fat_g,     unit: 'g', color: 'var(--macro-fat)',      bg: 'var(--brown-pale)' },
    { key: 'protein',  label: 'Protein',   short: 'Prot',  emoji: '🥩', current: Math.round(totals.protein_g), target: targets.protein_g, unit: 'g', color: 'var(--macro-protein)',  bg: 'var(--green-pale)' },
    { key: 'carbs',    label: 'Net carbs', short: 'Carbs', emoji: '🥦', current: Math.round(totals.carbs_g),   target: targets.carbs_g,   unit: 'g', color: 'var(--macro-carbs)',    bg: 'var(--gold-pale)', over: carbsOver },
    { key: 'calories', label: 'Calories',  short: 'Cal',   emoji: '🔥', current: Math.round(totals.calories),  target: targets.calories,  unit: '',  color: 'var(--macro-calories)', bg: 'var(--brown-pale)', over: targets && totals.calories > targets.calories },
  ] : [];
  const score = ketoScore(totals, targets);

  const formatDate = () => {
    const d = new Date(viewDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading) return <div className="dash-loading">Loading…</div>;

  return (
    <div className="dash-page">

      <div className="dash-top">
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="dash-greeting">
              <span className="section-label">⚡🥑 KetoTap</span>
              <span className="dash-hello">{viewDate === today ? greeting() : 'Looking back'}</span>
            </div>
            <div
              className={`keto-score keto-score--${scoreTone(score)}`}
              title="Keto score: net carbs under your limit (50), fat's share of calories (30), protein's share (20)"
            >
              <span className="section-label">Keto score</span>
              <span className="keto-score-value">{score ?? '—'}</span>
            </div>
          </div>
        </header>
        {targets && (
          <div className="macro-chips" ref={setRingsEl}>
            {macros.map(m => (
              <MacroChip key={m.label} {...m} highlight={alertKeys.has(m.key)} />
            ))}
          </div>
        )}
        {targets && (
          <MacroBanner
            alerts={alerts}
            date={viewDate}
            blockedCount={blocked.size}
            getSuggestion={alert => suggestFoodForGoal(alert, foods, totals, targets)}
          />
        )}
      </div>

      {targets && <CompactMacroBar macros={macros} visible={ringsOutOfView} />}

      <main className="dash-main">
        <div className="dash-date-nav">
          <button className="date-nav-btn" onClick={() => setViewDate(d => offsetDate(d, -1))}>‹</button>
          <div className="dash-date-center">
            <span className="dash-date-text">{formatDate()}</span>
            {viewDate !== today && (
              <button className="date-today-btn" onClick={() => setViewDate(today)}>Today</button>
            )}
          </div>
          <button className="date-nav-btn" onClick={() => setViewDate(d => offsetDate(d, 1))} disabled={viewDate === today}>›</button>
        </div>


        <div className="presets-section">
          <div className="presets-section-header">
            <span className="section-label">Presets</span>
          </div>
          <PresetsRow
            presets={presets}
            logs={logs}
            onLog={handlePresetLog}
            onRemove={handlePresetRemove}
            onManage={() => setShowPresetModal(true)}
          />
        </div>

        {targets && (
          <div className="intake-section">
            <div className="dash-section-header">
              <span className="section-label">Water &amp; electrolytes</span>
            </div>
            <IntakeRow
              intake={intake}
              targets={targets}
              onAdd={handleIntakeAdd}
              onUndo={handleIntakeUndo}
            />
          </div>
        )}

        <div className="dash-section-header">
          <span className="section-label">Foods</span>
          {logs.length > 0 && (
            <button className="btn-clear-all" onClick={handleClearAll}>Clear All</button>
          )}
        </div>

        {!tipDismissed && (
          <div className="foods-tip">
            <p><strong>Tip:</strong> tap <strong>+</strong> to log a food. Tap its emoji to change the portion.</p>
            <button onClick={dismissTip}>Got it</button>
          </div>
        )}

        <div className="food-filters">
          <div className="food-search-row">
            <input
              id="food-search"
              className="food-search"
              type="search"
              placeholder="Search foods"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search foods"
            />
            <button className="btn-scan-home" onClick={() => setScanning(true)} aria-label="Scan a barcode">
              <BarcodeIcon size={18} />
              <span>Scan</span>
            </button>
          </div>
          {foods.length > 0 && (
            <div className="filter-chips" role="group" aria-label="Filter foods">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`filter-chip${filter === f.key ? ' filter-chip--on' : ''}`}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {foods.length > 0 && visibleFoods.length === 0 ? (
          <p className="food-filter-empty">
            {filter === 'logged' && !q ? 'Nothing logged yet on this day.' : 'No foods match. Try another search or filter.'}
          </p>
        ) : (
          <FoodGrid
            foods={visibleFoods}
            logs={logs}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onEdit={handleEdit}
            recommendedIds={recommendedIds}
            blocked={blocked}
          />
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
      </main>

      <PresetModal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        foods={foods}
        todayLogs={logs}
        presets={presets}
        onPresetsChange={setPresets}
      />

      {scanning && (
        <ScanFlow
          foods={foods}
          getLimitWarning={macros => limitWarning(macros, totals, targets)}
          onSave={handleScanSave}
          onLogExisting={handleScanLog}
          onClose={() => setScanning(false)}
        />
      )}

      {pickerFood && (
        <PortionPickerSheet
          food={pickerFood}
          existingLog={pickerLog}
          onConfirm={handlePickerConfirm}
          onDismiss={handlePickerDismiss}
        />
      )}

      <BottomNav />
    </div>
  );
}
