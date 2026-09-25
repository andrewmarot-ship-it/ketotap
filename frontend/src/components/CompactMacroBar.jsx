import './CompactMacroBar.css';

export default function CompactMacroBar({ macros, visible }) {
  return (
    <div className={`cmb${visible ? ' cmb--visible' : ''}`} aria-hidden={!visible}>
      <div className="cmb-inner">
        <div className="cmb-brand">⚡🥑 KetoTap</div>
        <div className="cmb-bars">
          {macros.map(m => {
            const pct = m.target > 0 ? Math.min(m.current / m.target, 1) : 0;
            return (
              <div key={m.label} className="cmb-item">
                <div className="cmb-top">
                  <span>{m.label}</span>
                  <span className="cmb-nums">
                    <b>{m.current.toLocaleString()}</b>/{m.target.toLocaleString()}
                  </span>
                </div>
                <div className="cmb-track">
                  <div className="cmb-fill" style={{ width: `${pct * 100}%`, background: m.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
