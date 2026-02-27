import { useRef } from 'react';
import './FoodGrid.css';

const LONG_PRESS_MS = 600;

function FoodTile({ food, servings, onTap, onLongPress, tapping }) {
  const timerRef = useRef(null);
  const isActive = tapping === food.id;

  function startPress() {
    timerRef.current = setTimeout(() => {
      onLongPress(food);
    }, LONG_PRESS_MS);
  }

  function endPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClick() {
    onTap(food);
  }

  return (
    <button
      className={`food-tile ${servings > 0 ? 'food-tile--active' : ''} ${isActive ? 'food-tile--tapping' : ''}`}
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      disabled={isActive}
    >
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

      {servings > 0 && (
        <div className="food-tile-badge">{servings}</div>
      )}

      {isActive && (
        <div className="food-tile-overlay">+1</div>
      )}
    </button>
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
