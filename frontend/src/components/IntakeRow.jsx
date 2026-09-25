import './IntakeRow.css';

const KINDS = [
  { key: 'water',     label: 'Water',     emoji: '💧', target: 'water_ml',     color: '#3498DB', step: '250 ml' },
  { key: 'sodium',    label: 'Sodium',    emoji: '🧂', target: 'sodium_mg',    color: '#A67C52', step: '500 mg' },
  { key: 'potassium', label: 'Potassium', emoji: '🥑', target: 'potassium_mg', color: '#27AE60', step: '350 mg' },
  { key: 'magnesium', label: 'Magnesium', emoji: '✨', target: 'magnesium_mg', color: '#C8A84B', step: '100 mg' },
];

function formatAmount(kind, value) {
  if (kind === 'water') {
    return `${Number((value / 1000).toFixed(2))}`;
  }
  return Math.round(value).toLocaleString();
}

export default function IntakeRow({ intake, targets, onAdd, onUndo }) {
  return (
    <div className="intake-grid">
      {KINDS.map(k => {
        const current = intake[k.key] || 0;
        const goal = targets[k.target] || 0;
        const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
        const unit = k.key === 'water' ? 'L' : 'mg';
        return (
          <div key={k.key} className={`intake-card${pct >= 1 ? ' intake-card--done' : ''}`}>
            <div className="intake-top">
              <span className="intake-emoji" aria-hidden="true">{k.emoji}</span>
              <span className="intake-label">{k.label}</span>
            </div>
            <div className="intake-amount">
              <strong>{formatAmount(k.key, current)}</strong>
              <span> / {formatAmount(k.key, goal)} {unit}</span>
            </div>
            <div className="intake-bar" aria-hidden="true">
              <div className="intake-bar-fill" style={{ width: `${pct * 100}%`, background: k.color }} />
            </div>
            <div className="intake-actions">
              <button
                className="intake-btn intake-btn--minus"
                onClick={() => onUndo(k.key)}
                disabled={current <= 0}
                aria-label={`Undo last ${k.label}`}
              >
                −
              </button>
              <button
                className="intake-btn intake-btn--plus"
                onClick={() => onAdd(k.key)}
                aria-label={`Add ${k.step} ${k.label}`}
              >
                + {k.step}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
