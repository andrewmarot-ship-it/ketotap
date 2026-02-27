import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logsApi } from '../api/client';
import './HistoryPage.css';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    logsApi.history()
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openDay(date) {
    setSelected(date);
    setDetailLoading(true);
    try {
      const res = await logsApi.historyDay(date);
      setDetail(res.data);
    } catch {}
    finally { setDetailLoading(false); }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return (
    <div className="history-page">
      <header className="history-header">
        <Link to="/" className="back-link">← Dashboard</Link>
        <h1>History</h1>
        <div />
      </header>

      {loading ? (
        <div className="history-loading">Loading…</div>
      ) : history.length === 0 ? (
        <div className="history-empty">No history yet. Start logging on the dashboard!</div>
      ) : (
        <div className="history-content">
          <div className="history-list">
            {history.map(day => (
              <button
                key={day.date}
                className={`history-day card ${selected === day.date ? 'history-day--selected' : ''}`}
                onClick={() => openDay(day.date)}
              >
                <div className="history-day-date">{formatDate(day.date)}</div>
                <div className="history-day-macros">
                  <div className="hist-macro">
                    <span className="hist-macro-val">{Math.round(day.calories)}</span>
                    <span className="hist-macro-label">kcal</span>
                  </div>
                  <div className="hist-macro">
                    <span className="hist-macro-val">{Math.round(day.fat_g)}g</span>
                    <span className="hist-macro-label">fat</span>
                  </div>
                  <div className="hist-macro">
                    <span className="hist-macro-val">{Math.round(day.protein_g)}g</span>
                    <span className="hist-macro-label">protein</span>
                  </div>
                  <div className="hist-macro">
                    <span className="hist-macro-val">{Math.round(day.carbs_g)}g</span>
                    <span className="hist-macro-label">carbs</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="history-detail card">
              <h3>{formatDate(selected)} — Foods Eaten</h3>
              {detailLoading ? (
                <p className="history-loading">Loading…</p>
              ) : detail.length === 0 ? (
                <p className="history-empty">No food logged this day.</p>
              ) : (
                <div className="detail-list">
                  {detail.map(log => (
                    <div key={log.id} className="detail-row">
                      <div className="detail-img">
                        {log.image_url
                          ? <img src={log.image_url} alt={log.name} onError={e => e.target.style.display='none'} />
                          : <span>🍽️</span>
                        }
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
      )}
    </div>
  );
}
