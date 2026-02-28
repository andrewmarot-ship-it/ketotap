import './FoodGrid.css';

function FoodTile({ food, servings, onTap, onLongPress, tapping }) {
  const isProcessing = tapping === food.id;

  return (
    <div
      className={`food-tile ${servings > 0 ? 'food-tile--active' : ''} ${isProcessing ? 'food-tile--tapping' : ''}`}
      onClick={() => onTap(food)}
    >
      {/* Minus — top left, only visible when serving count > 0 */}
      {servings > 0 && (
        <button
          className="tile-adj tile-adj--minus"
          onClick={e => { e.stopPropagation(); onLongPress(food); }}
          aria-label="Remove serving"
        >
          −
        </button>
      )}

      {/* Plus — top right, always visible */}
      <button
        className="tile-adj tile-adj--plus"
        onClick={e => { e.stopPropagation(); onTap(food); }}
        aria-label="Add serving"
      >
        +
      </button>

      {/* Serving count — centered between the two buttons */}
      {servings > 0 && (
        <div className="food-tile-count">×{servings}</div>
      )}

      <div className="food-tile-img-wrap">
        {food.image_url ? (
          <img
            src={food.image_url}
            alt={food.name}
            className="food-tile-img"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className="food-tile-emoji" style={{ display: food.image_url ? 'none' : 'flex' }}>🍽️</div>
      </div>

      <div className="food-tile-info">
        <span className="food-tile-name">{food.name}</span>
        <span className="food-tile-serving">{food.serving_description}</span>
        <span className="food-tile-cals">{food.calories} kcal</span>
      </div>
    </div>
  );
}

export default function FoodGrid({ foods, logs, onTap, onLongPress, tapping }) {
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
          onTap={onTap}
          onLongPress={onLongPress}
          tapping={tapping}
        />
      ))}
    </div>
  );
}
