import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { logsApi } from '../api/client';
import BottomNav from '../components/BottomNav';
import './HistoryPage.css';

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MACRO_CONFIG = [
  { key: 'calories', label: 'Calories', color: '#E74C3C' },
  { key: 'fat_g',    label: 'Fat (g)',  color: '#F39C12' },
  { key: 'protein_g', label: 'Protein (g)', color: '#2ECC71' },
  { key: 'carbs_g',  label: 'Carbs (g)', color: '#3498DB' },
];

function Calendar({ year, month, dayData, selectedDate, onSelectDate }) {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = new Date(year, month, 1).getDay(); // 0 = Sunday

  // Build cell list: nulls for padding, then day numbers
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="cal">
      <div className="cal-weekdays">
        {WEEK_DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cal-cell cal-cell--empty" />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data = dayData[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isFuture = dateStr > todayStr;
          const hasData = !!data;
          const isCompleted = data?.completed;

          return (
            <button
              key={dateStr}
              className={[
                'cal-cell',
                hasData ? 'cal-cell--has-data' : '',
                isToday ? 'cal-cell--today' : '',
                isSelected ? 'cal-cell--selected' : '',
                isFuture ? 'cal-cell--future' : '',
                isCompleted ? 'cal-cell--completed' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => hasData && !isFuture && onSelectDate(dateStr)}
              disabled={!hasData || isFuture}
            >
              <span className="cal-day-num">{day}</span>
              {hasData && <span className="cal-kcal">{Math.round(data.calories)}</span>}
              {isCompleted && <span className="cal-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MacroChart({ dayData, visibleMacros, onToggleMacro }) {
  const chartData = Object.entries(dayData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      day: parseInt(date.slice(8), 10),
      calories: Math.round(d.calories),
      fat_g: Math.round(d.fat_g),
      protein_g: Math.round(d.protein_g),
      carbs_g: Math.round(d.carbs_g),
    }));

  if (chartData.length === 0) {
    return <p className="history-empty">No data this month to chart.</p>;
  }

  return (
    <div className="chart-section">
      <div className="macro-toggles">
        {MACRO_CONFIG.map(({ key, label, color }) => (
          <button
            key={key}
            className={`macro-toggle-btn ${visibleMacros[key] ? 'active' : ''}`}
            style={{ '--toggle-color': color }}
            onClick={() => onToggleMacro(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#888' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#888' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e0e0e0' }}
              labelFormatter={day => `Day ${day}`}
            />
            {MACRO_CONFIG.map(({ key, label, color }) =>
              visibleMacros[key] ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-indexed
  const [dayData, setDayData] = useState({}); // { dateStr: { calories, fat_g, protein_g, carbs_g, completed } }
  const [monthLoading, setMonthLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState('calendar');
  const [visibleMacros, setVisibleMacros] = useState({
    calories: true, fat_g: true, protein_g: true, carbs_g: true,
  });

  // Load data whenever the viewed month changes
  useEffect(() => {
    setMonthLoading(true);
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    logsApi.historyMonth(monthStr)
      .then(r => {
        const map = {};
        for (const d of r.data) map[d.date] = d;
        setDayData(map);
      })
      .catch(() => {})
      .finally(() => setMonthLoading(false));
  }, [currentYear, currentMonth]);

  async function handleSelectDate(date) {
    setSelected(date);
    setDetailLoading(true);
    try {
      const res = await logsApi.historyDay(date);
      setDetail(res.data);
    } catch {}
    finally { setDetailLoading(false); }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelected(null);
    setDetail([]);
  }

  function nextMonth() {
    // Don't go past current month
    if (currentYear === now.getFullYear() && currentMonth === now.getMonth()) return;
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelected(null);
    setDetail([]);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function toggleMacro(key) {
    setVisibleMacros(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
  const hasDayData = Object.keys(dayData).length > 0;

  return (
    <div className="history-page">
      <header className="history-header">
        <h1>History</h1>
      </header>

      <div className="history-content">
        {/* Month navigation */}
        <div className="cal-nav card">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <span className="cal-nav-title">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            className="cal-nav-btn"
            onClick={nextMonth}
            disabled={isCurrentMonth}
          >
            ›
          </button>
        </div>

        {/* Tab switcher */}
        <div className="history-tabs">
          <button
            className={`tab-btn ${tab === 'calendar' ? 'active' : ''}`}
            onClick={() => setTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`tab-btn ${tab === 'chart' ? 'active' : ''}`}
            onClick={() => setTab('chart')}
          >
            Chart
          </button>
        </div>

        {/* Calendar tab */}
        {tab === 'calendar' && (
          <div className="cal-wrap card">
            {monthLoading ? (
              <div className="history-loading">Loading…</div>
            ) : (
              <>
                {!hasDayData && (
                  <div className="cal-empty-msg">No logs this month</div>
                )}
                <Calendar
                  year={currentYear}
                  month={currentMonth}
                  dayData={dayData}
                  selectedDate={selected}
                  onSelectDate={handleSelectDate}
                />
                <div className="cal-legend">
                  <span className="cal-legend-item">
                    <span className="cal-legend-dot" />
                    Logged
                  </span>
                  <span className="cal-legend-item">
                    <span className="cal-legend-check">✓</span>
                    Completed
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Chart tab */}
        {tab === 'chart' && (
          <div className="cal-wrap card">
            {monthLoading ? (
              <div className="history-loading">Loading…</div>
            ) : (
              <MacroChart
                dayData={dayData}
                visibleMacros={visibleMacros}
                onToggleMacro={toggleMacro}
              />
            )}
          </div>
        )}

        {/* Day detail panel (calendar tab only) */}
        {tab === 'calendar' && selected && (
          <div className="history-detail card">
            <div className="detail-header">
              <h3>{formatDate(selected)}</h3>
              {dayData[selected] && (
                <div className="detail-macro-row">
                  <span className="detail-macro">{Math.round(dayData[selected].calories)} kcal</span>
                  <span className="detail-macro">{Math.round(dayData[selected].fat_g)}g fat</span>
                  <span className="detail-macro">{Math.round(dayData[selected].protein_g)}g protein</span>
                  <span className="detail-macro">{Math.round(dayData[selected].carbs_g)}g carbs</span>
                  {dayData[selected].completed && <span className="detail-completed">✓ Completed</span>}
                </div>
              )}
            </div>
            {detailLoading ? (
              <p className="history-loading">Loading…</p>
            ) : detail.length === 0 ? (
              <p className="history-empty">No food logged this day.</p>
            ) : (
              <div className="detail-list">
                {detail.map(log => (
                  <div key={log.id} className="detail-row">
                    <div className="detail-img">
                      <span>{log.emoji || '🍽️'}</span>
                    </div>
                    <div className="detail-info">
                      <span className="detail-name">{log.name}</span>
                      <span className="detail-serving">{log.serving_description} × {log.servings}</span>
                    </div>
                    <div className="detail-cals">
                      {Math.round(log.calories * log.servings)} kcal
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
