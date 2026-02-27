import './MacroBar.css';

export default function MacroBar({ label, current, target, unit, color, small }) {
  const pct = Math.min((current / target) * 100, 100);
  const over = current > target;
  const remaining = target - current;

  return (
    <div className={`macro-bar ${small ? 'macro-bar--small' : ''}`}>
      <div className="macro-bar-header">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-values">
          <span className="macro-bar-current" style={{ color: over ? 'var(--over-limit)' : color }}>
            {current}{unit}
          </span>
          <span className="macro-bar-sep">/</span>
          <span className="macro-bar-target">{target}{unit}</span>
        </span>
      </div>

      <div className="macro-bar-track">
        <div
          className="macro-bar-fill"
          style={{
            width: `${pct}%`,
            background: over ? 'var(--over-limit)' : color,
          }}
        />
      </div>

      {!small && (
        <div className="macro-bar-remaining" style={{ color: over ? 'var(--over-limit)' : 'var(--text-secondary)' }}>
          {over
            ? `${Math.round(current - target)}${unit} over limit`
            : `${Math.round(remaining)}${unit} remaining`}
        </div>
      )}
    </div>
  );
}
