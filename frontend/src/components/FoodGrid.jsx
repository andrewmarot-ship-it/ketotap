import './FoodGrid.css';

function FoodTile({ food, servings, onAdd, onRemove }) {
  return (
    <div className={`food-tile ${servings > 0 ? 'food-tile--active' : ''}`}>

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

      {/* Plus — top-right, always visible */}
      <button
        className="tile-adj tile-adj--plus"
        onClick={() => onAdd(food)}
        aria-label="Add serving"
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

export default function FoodGrid({ foods, logs, onAdd, onRemove }) {
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
        />
      ))}
    </div>
  );
}
