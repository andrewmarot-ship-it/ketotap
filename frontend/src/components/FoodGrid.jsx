import './FoodGrid.css';

function FoodTile({ food, servings, onAdd, onRemove, suggested, blocked }) {
  const tileClass = [
    'food-tile',
    servings > 0 ? 'food-tile--active' : '',
    suggested ? 'food-tile--suggested' : '',
    blocked ? 'food-tile--blocked' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={tileClass}>

      {/* Minus — top-left, only when a serving has been logged */}
      {servings > 0 && (
        <button
          className="tile-adj tile-adj--minus"
          onClick={() => onRemove(food)}
          aria-label="Remove serving"
        >
          −
        </button>
      )}

      {/* Plus — disabled when food would exceed calorie budget */}
      <button
        className="tile-adj tile-adj--plus"
        onClick={() => !blocked && onAdd(food)}
        aria-label="Add serving"
        aria-disabled={blocked}
      >
        +
      </button>

      {/* Serving count between the buttons */}
      {servings > 0 && (
        <div className="food-tile-count">×{servings}</div>
      )}

      {/* Food image or emoji */}
      <div className="food-tile-img-wrap">
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
        <span className="food-tile-cals">{food.calories} kcal</span>
      </div>
    </div>
  );
}

export default function FoodGrid({ foods, logs, onAdd, onRemove, recommendedIds = new Set(), blockedIds = new Set() }) {
  const servingsMap = {};
  for (const log of logs) {
    servingsMap[log.food_id] = log.servings;
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
          suggested={recommendedIds.has(food.id)}
          blocked={blockedIds.has(food.id)}
        />
      ))}
    </div>
  );
}
