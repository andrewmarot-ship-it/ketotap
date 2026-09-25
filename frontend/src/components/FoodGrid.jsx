import { formatPortion } from '../utils/macroCalculator';
import './FoodGrid.css';

function FoodTile({ food, servings, onAdd, onRemove, onEdit, suggested, blocked }) {
  const logged = servings > 0;
  const tileClass = [
    'food-tile',
    logged ? 'food-tile--active' : '',
    suggested ? 'food-tile--suggested' : '',
    blocked ? 'food-tile--blocked' : '',
  ].filter(Boolean).join(' ');

  const emojiTappable = logged && onEdit;

  return (
    <div className={tileClass}>
      {/* Emoji well — tappable when logged (opens portion editor) */}
      <div
        className="food-tile-img-wrap"
        onClick={emojiTappable ? () => onEdit(food) : undefined}
        style={emojiTappable ? { cursor: 'pointer' } : undefined}
        role={emojiTappable ? 'button' : undefined}
        aria-label={emojiTappable ? `Edit ${food.name} portion` : undefined}
        tabIndex={emojiTappable ? 0 : undefined}
        onKeyDown={emojiTappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(food); } : undefined}
      >
        {food.image_url ? (
          <img
            src={food.image_url}
            alt={food.name}
            className="food-tile-img"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className="food-tile-emoji"
          style={{ display: food.image_url ? 'none' : 'flex' }}
        >
          {food.emoji || '🍽️'}
        </div>
      </div>

      <div className="food-tile-info">
        <span className="food-tile-name">{food.name}</span>
        <span className="food-tile-serving">{food.serving_description}</span>
        <span className="food-tile-cals">
          {logged ? `${Math.round(food.calories * servings)} kcal eaten` : `${food.calories} kcal`}
        </span>
      </div>

      <div className="food-tile-qty">
        {logged && (
          <>
            <button className="qty-btn qty-btn--minus" onClick={() => onRemove(food)} aria-label={`Remove a serving of ${food.name}`}>
              −
            </button>
            <span className="qty-count">{formatPortion(servings)}</span>
          </>
        )}
        <button
          className="qty-btn qty-btn--plus"
          onClick={() => !blocked && onAdd(food)}
          aria-label={`Add ${food.name}`}
          aria-disabled={blocked}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function FoodGrid({ foods, logs, onAdd, onRemove, onEdit, recommendedIds = new Set(), blockedIds = new Set() }) {
  const servingsMap = {};
  for (const log of logs) {
    servingsMap[log.food_id] = (servingsMap[log.food_id] || 0) + log.servings * (log.portion_multiplier ?? 1);
  }

  if (foods.length === 0) {
    return (
      <div className="food-grid-empty">
        <p>No foods in database yet.</p>
        <p>Go to <strong>Foods</strong> to add some keto staples!</p>
      </div>
    );
  }

  return (
    <div className="food-grid">
      {foods.map(food => (
        <FoodTile
          key={food.id}
          food={food}
          servings={servingsMap[food.id] || 0}
          onAdd={onAdd}
          onRemove={onRemove}
          onEdit={onEdit}
          suggested={recommendedIds.has(food.id)}
          blocked={blockedIds.has(food.id)}
        />
      ))}
    </div>
  );
}
