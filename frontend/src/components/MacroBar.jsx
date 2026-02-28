import './MacroBar.css';

export default function MacroBar({ label, current, target, unit, color, size = 62 }) {
  const stroke = 5;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const over = current > target;
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const offset = circumference * (1 - progress);
  const arcColor = over ? 'var(--over-limit)' : color;

  return (
    <div className="macro-ring">
      <div className="macro-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </svg>
        <div className="macro-ring-inner">
          <span className="macro-ring-value" style={{ color: arcColor }}>{current}</span>
        </div>
      </div>
      <span className="macro-ring-label">{label}</span>
      <span className="macro-ring-target">/{target}{unit}</span>
    </div>
  );
}
