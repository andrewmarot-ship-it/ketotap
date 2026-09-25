import './IntakeRow.css';

const KINDS = [
  { key: 'water',     label: 'Water',     emoji: '💧', target: 'water_ml',     color: '#3498DB', step: '250 ml' },
  { key: 'sodium',    label: 'Sodium',    emoji: '🧂', target: 'sodium_mg',    color: '#A67C52', step: '500 mg' },
  { key: 'potassium', label: 'Potassium', emoji: '🥑', target: 'potassium_mg', color: '#27AE60', step: '350 mg' },
  { key: 'magnesium', label: 'Magnesium', emoji: '✨', target: 'magnesium_mg', color: '#C8A84B', step: '100 mg' },
];

const SIZE = 48;
const STROKE = 4;
const R = (SIZE - STROKE * 2) / 2;
const CIRC = 2 * Math.PI * R;

function formatAmount(kind, value) {
  if (kind === 'water') return `${Number((value / 1000).toFixed(2))}`;
  return Math.round(value).toLocaleString();
}

export default function IntakeRow({ intake, targets, onAdd, onUndo }) {
  return (
    <div className="intake-row card">
      {KINDS.map(k => {
        const current = intake[k.key] || 0;
        const goal = targets[k.target] || 0;
        const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
        const unit = k.key === 'water' ? 'L' : 'mg';
        return (
          <div key={k.key} className="intake-item">
            {current > 0 && (
              <button
                className="intake-undo"
                onClick={() => onUndo(k.key)}
                aria-label={`Undo last ${k.label}`}
              >
                −
              </button>
            )}
            <button
              className="intake-ring"
              onClick={() => onAdd(k.key)}
              aria-label={`Add ${k.step} ${k.label}. ${formatAmount(k.key, current)} of ${formatAmount(k.key, goal)} ${unit}`}
            >
              <svg width={SIZE} height={SIZE} aria-hidden="true">
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
                <circle
                  cx={SIZE / 2} cy={SIZE / 2} r={R}
                  fill="none"
                  stroke={k.color}
                  strokeWidth={STROKE}
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - pct)}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  className="intake-arc"
                />
              </svg>
              <span className="intake-emoji" aria-hidden="true">{k.emoji}</span>
            </button>
            <span className="intake-amount">
              <strong>{formatAmount(k.key, current)}</strong>
              <span>/ {formatAmount(k.key, goal)} {unit}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
