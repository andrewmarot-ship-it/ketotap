import { useEffect, useState } from 'react';
import './MacroChip.css';

const SIZE = 52;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function MacroChip({ label, emoji, current, target, unit, color, bg, over }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;

  // Start empty, then grow to the real value so the arc springs in on load
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  const remaining = Math.round(target - current);
  const arcColor = over ? 'var(--over-limit)' : color;

  return (
    <div className="macro-chip" style={{ background: bg }}>
      <div className="macro-chip-ring" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={STROKE} />
          <circle
            className="macro-chip-arc"
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={arcColor}
            strokeWidth={STROKE}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - shown)}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <span className="macro-chip-emoji" aria-hidden="true">{emoji}</span>
      </div>
      <div className="macro-chip-text">
        <span className="macro-chip-label" style={{ color: arcColor }}>{label}</span>
        <span className="macro-chip-value">
          {current.toLocaleString()}
          <small>{unit ? ` ${unit}` : ''} / {target.toLocaleString()}</small>
        </span>
        <span className={`macro-chip-left${over ? ' macro-chip-left--over' : ''}`}>
          {remaining >= 0
            ? `${remaining.toLocaleString()}${unit} left`
            : `${Math.abs(remaining).toLocaleString()}${unit} over`}
        </span>
      </div>
    </div>
  );
}
