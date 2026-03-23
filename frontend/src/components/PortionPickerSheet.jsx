import { useState } from 'react';
import { applyMultiplier } from '../utils/macroCalculator';
import './PortionPickerSheet.css';

const CHIPS = [
  {
    multiplier: 0.5,
    label: '½×',
    selectedBg: '#EDE0D0',
    selectedBorder: '#7A5230',
    selectedText: '#7A5230',
  },
  {
    multiplier: 1,
    label: '1×',
    selectedBg: '#D6EAD8',
    selectedBorder: '#27AE60',
    selectedText: '#27AE60',
  },
  {
    multiplier: 2,
    label: '2×',
    selectedBg: '#F5EAC8',
    selectedBorder: '#C8A84B',
    selectedText: '#C8A84B',
  },
];

const MACRO_FIELDS = [
  { key: 'fat_g',     label: 'Fat',       unit: 'g',    color: '#A67C52' },
  { key: 'protein_g', label: 'Protein',   unit: 'g',    color: '#27AE60' },
  { key: 'carbs_g',   label: 'Net Carbs', unit: 'g',    color: '#C8A84B' },
  { key: 'calories',  label: 'Calories',  unit: 'kcal', color: '#5A7A5E' },
];

// Extract gram weight from serving description like "½ avocado (~100 g)" or "1 tbsp (14 g)"
function parseBaseGrams(servingDescription) {
  const match = (servingDescription || '').match(/(\d+)\s*g/i);
  return match ? parseInt(match[1], 10) : 100;
}

function ctaLabel(multiplier, isEditMode) {
  if (isEditMode) return 'Update Serving';
  if (multiplier === 0.5) return 'Add ½ Serving';
  if (multiplier === 2)   return 'Add 2 Servings';
  return 'Add 1 Serving';
}

export default function PortionPickerSheet({ food, existingLog, onConfirm, onDismiss }) {
  const defaultMultiplier = existingLog?.portion_multiplier ?? 1;
  const [selectedMultiplier, setSelectedMultiplier] = useState(defaultMultiplier);

  const isEditMode = !!existingLog;
  const base = {
    fat_g:     food.fat_g,
    protein_g: food.protein_g,
    carbs_g:   food.carbs_g,
    calories:  food.calories,
  };
  const adjusted = applyMultiplier(base, selectedMultiplier);
  const baseGrams = parseBaseGrams(food.serving_description);

  return (
    <div
      className="pp-overlay"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`Portion picker for ${food.name}`}
    >
      <div className="pp-sheet" onClick={e => e.stopPropagation()}>

        {/* Zone 1: Food identity header */}
        <div className="pp-header">
          <div className="pp-emoji" aria-hidden="true">
            {food.emoji || '🍽️'}
          </div>
          <div className="pp-food-info">
            <span className="pp-food-name">{food.name}</span>
            <span className="pp-food-serving">1 serving · {food.serving_description}</span>
          </div>
        </div>

        {/* Zone 2: Portion selector */}
        <div className="pp-chips" role="group" aria-label="Portion size">
          {CHIPS.map(chip => {
            const isSelected = selectedMultiplier === chip.multiplier;
            const chipAdjusted = applyMultiplier(base, chip.multiplier);
            return (
              <button
                key={chip.multiplier}
                className="pp-chip"
                style={isSelected ? {
                  background: chip.selectedBg,
                  borderColor: chip.selectedBorder,
                  color: chip.selectedText,
                } : {}}
                onClick={() => setSelectedMultiplier(chip.multiplier)}
                aria-pressed={isSelected}
                aria-label={`${chip.label} — ${Math.round(baseGrams * chip.multiplier)}g, ${chipAdjusted.calories} calories`}
              >
                <span className="pp-chip-label">{chip.label}</span>
                <span className="pp-chip-grams">{Math.round(baseGrams * chip.multiplier)}g</span>
              </button>
            );
          })}
        </div>

        {/* Zone 3: Live macro preview */}
        <div className="pp-macros">
          {MACRO_FIELDS.map(m => (
            <div key={m.key} className="pp-macro-chip">
              <span className="pp-macro-value" style={{ color: m.color }}>
                {adjusted[m.key]}{m.unit}
              </span>
              <span className="pp-macro-label">{m.label}</span>
              {selectedMultiplier !== 1 && (
                <span className="pp-macro-base">base: {base[m.key]}{m.unit}</span>
              )}
            </div>
          ))}
        </div>

        {/* Zone 4: Action bar */}
        <div className="pp-actions">
          <button
            className="pp-cta"
            onClick={() => onConfirm(selectedMultiplier)}
            aria-label={ctaLabel(selectedMultiplier, isEditMode)}
          >
            {ctaLabel(selectedMultiplier, isEditMode)}
          </button>
          <button className="pp-cancel" onClick={onDismiss}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
