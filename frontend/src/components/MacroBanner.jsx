import { useState } from 'react';
import { MACROS, describeAlert } from '../utils/macroStatus';
import './MacroBanner.css';

const storageKey = date => `kt_banner_dismissed_${date}`;

function readDismissed(date) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey(date)) || '[]'));
  } catch {
    return new Set();
  }
}

// Dismissal is per macro + state, so going from "3 g left" to "over" shows again
const alertId = a => `${a.key}:${a.kind}`;

export default function MacroBanner({ alerts, date, getSuggestion, blockedCount }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(date));
  const [dismissedDate, setDismissedDate] = useState(date);
  const [index, setIndex] = useState(0);

  // Reload dismissals when the viewed day changes
  if (dismissedDate !== date) {
    setDismissedDate(date);
    setDismissed(readDismissed(date));
    setIndex(0);
  }

  const visible = alerts.filter(a => !dismissed.has(alertId(a)));
  if (visible.length === 0) return null;

  const alert = visible[index % visible.length];
  const text = describeAlert(alert, {
    suggestion: alert.kind === 'goal' ? getSuggestion(alert) : null,
    blockedCount,
  });
  const tone = alert.kind === 'over' ? 'over' : `${alert.kind}-${alert.key}`;

  function dismiss() {
    const next = new Set(dismissed).add(alertId(alert));
    setDismissed(next);
    setIndex(0);
    try { localStorage.setItem(storageKey(date), JSON.stringify([...next])); } catch { /* storage unavailable */ }
  }

  return (
    <div className={`macro-banner mb--${tone}`} role="status" aria-live="polite">
      <span className="mb-icon" aria-hidden="true">{alert.kind === 'done' ? '🎉' : MACROS[alert.key].emoji}</span>
      <span className="mb-text">
        <strong>{text.title}</strong>
        <span>{text.detail}</span>
      </span>
      {visible.length > 1 ? (
        <button className="mb-more" onClick={() => setIndex(i => i + 1)}>
          +{visible.length - 1} more
        </button>
      ) : (
        <span className="mb-pill">{text.pill}</span>
      )}
      <button className="mb-close" onClick={dismiss} aria-label="Dismiss for today">✕</button>
      <span className="mb-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(alert.pct, 1) * 100}%` }} />
      </span>
    </div>
  );
}
