import './PresetsRow.css';

export default function PresetsRow({ presets, onLog, onManage }) {
  if (presets.length === 0) {
    return (
      <div className="presets-row presets-row--empty">
        <span className="presets-empty-text">No presets yet</span>
        <button className="presets-manage-btn" onClick={onManage}>+ Create preset</button>
      </div>
    );
  }

  return (
    <div className="presets-row">
      <div className="presets-scroll">
        {presets.map(preset => {
          const totalCal = preset.items.reduce(
            (sum, item) => sum + item.calories * item.servings, 0
          );
          return (
            <button
              key={preset.id}
              className="preset-pill"
              onClick={() => onLog(preset)}
              title={`Log ${preset.name} (${Math.round(totalCal)} kcal)`}
            >
              <span className="preset-pill-emoji">{preset.emoji}</span>
              <span className="preset-pill-name">{preset.name}</span>
              <span className="preset-pill-cal">{Math.round(totalCal)} kcal</span>
            </button>
          );
        })}
      </div>
      <button className="presets-manage-btn" onClick={onManage}>Manage</button>
    </div>
  );
}
