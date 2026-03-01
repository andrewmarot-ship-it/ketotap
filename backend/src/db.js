const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'ketotap.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    calories INTEGER NOT NULL DEFAULT 2000,
    fat_g INTEGER NOT NULL DEFAULT 150,
    protein_g INTEGER NOT NULL DEFAULT 100,
    carbs_g INTEGER NOT NULL DEFAULT 20,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    serving_description TEXT NOT NULL,
    calories INTEGER NOT NULL,
    fat_g REAL NOT NULL,
    protein_g REAL NOT NULL,
    carbs_g REAL NOT NULL,
    image_url TEXT,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    food_id INTEGER NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS completed_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Add emoji column if it doesn't exist yet (safe to run every startup)
try {
  db.exec("ALTER TABLE foods ADD COLUMN emoji TEXT NOT NULL DEFAULT '🍽️'");
} catch (_) { /* column already exists */ }

// Assign emojis and clear Unsplash photos for default seeded foods (idempotent)
const defaultFoodEmojis = [
  ['Avocado',         '🥑'],
  ['Eggs',            '🥚'],
  ['Egg',             '🥚'],
  ['Bacon',           '🥓'],
  ['Salmon',          '🐟'],
  ['Cheddar Cheese',  '🧀'],
  ['Cheese Stick',    '🧀'],
  ['Cream Cheese',    '🧀'],
  ['Butter',          '🧈'],
  ['Ground Beef',     '🥩'],
  ['Broccoli',        '🥦'],
  ['Spinach',         '🥬'],
  ['Almonds',         '🌰'],
  ['Heavy Cream',     '🥛'],
  ['Chicken Thigh',   '🍗'],
  ['Chicken Breast',  '🍗'],
  ['Olive Oil',       '🫒'],
  ['Fish Fillet',     '🐠'],
  ['Tuna',            '🐟'],
  ['Caesar Dressing', '🥗'],
  ['Pepperoni',       '🍕'],
];

const updateEmoji = db.prepare(
  "UPDATE foods SET emoji = ?, image_url = NULL WHERE name = ? AND created_by_user_id IS NULL AND emoji = '🍽️'"
);
for (const [name, emoji] of defaultFoodEmojis) {
  updateEmoji.run(emoji, name);
}

// Seed default keto foods — idempotent: inserts only foods not yet present by name
const seedFoods = [
  // From requested food list
  { name: 'Avocado',         serving_description: '1 whole (200g)',       calories: 320, fat_g: 29,   protein_g: 4,   carbs_g: 2,   emoji: '🥑' },
  { name: 'Egg',             serving_description: '1 large',              calories: 70,  fat_g: 5,    protein_g: 6,   carbs_g: 0.5, emoji: '🥚' },
  { name: 'Almonds',         serving_description: '1 oz (28g)',           calories: 164, fat_g: 14,   protein_g: 6,   carbs_g: 2.5, emoji: '🌰' },
  { name: 'Broccoli',        serving_description: '1 cup (90g)',          calories: 55,  fat_g: 0.6,  protein_g: 3.7, carbs_g: 6,   emoji: '🥦' },
  { name: 'Olive Oil',       serving_description: '1 tbsp (14ml)',        calories: 119, fat_g: 13.5, protein_g: 0,   carbs_g: 0,   emoji: '🫒' },
  { name: 'Heavy Cream',     serving_description: '1 tbsp (15ml)',        calories: 52,  fat_g: 5.5,  protein_g: 0.3, carbs_g: 0.4, emoji: '🥛' },
  { name: 'Cheese Stick',    serving_description: '1 stick (28g)',        calories: 80,  fat_g: 5,    protein_g: 7,   carbs_g: 1,   emoji: '🧀' },
  { name: 'Chicken Breast',  serving_description: '1 cup cooked (140g)', calories: 231, fat_g: 5,    protein_g: 43,  carbs_g: 0,   emoji: '🍗' },
  { name: 'Fish Fillet',     serving_description: '1 fillet (113g)',      calories: 110, fat_g: 2,    protein_g: 23,  carbs_g: 0,   emoji: '🐠' },
  { name: 'Salmon',          serving_description: '1 portion (150g)',     calories: 280, fat_g: 18,   protein_g: 28,  carbs_g: 0,   emoji: '🐟' },
  { name: 'Caesar Dressing', serving_description: '2 tbsp (30g)',         calories: 156, fat_g: 16,   protein_g: 1,   carbs_g: 1,   emoji: '🥗' },
  { name: 'Tuna',            serving_description: '3 oz can (85g)',       calories: 73,  fat_g: 0.5,  protein_g: 17,  carbs_g: 0,   emoji: '🐟' },
  // Keto staples to complete the set
  { name: 'Bacon',           serving_description: '3 slices (45g)',       calories: 180, fat_g: 14,   protein_g: 12,  carbs_g: 0,   emoji: '🥓' },
  { name: 'Cheddar Cheese',  serving_description: '1 oz (28g)',           calories: 115, fat_g: 9,    protein_g: 7,   carbs_g: 0.4, emoji: '🧀' },
  { name: 'Butter',          serving_description: '1 tbsp (14g)',         calories: 100, fat_g: 11,   protein_g: 0.1, carbs_g: 0,   emoji: '🧈' },
  { name: 'Ground Beef',     serving_description: '4 oz (113g)',          calories: 300, fat_g: 23,   protein_g: 22,  carbs_g: 0,   emoji: '🥩' },
  { name: 'Chicken Thigh',   serving_description: '1 thigh (100g)',       calories: 209, fat_g: 13,   protein_g: 22,  carbs_g: 0,   emoji: '🍗' },
  { name: 'Cream Cheese',    serving_description: '2 tbsp (30g)',         calories: 99,  fat_g: 10,   protein_g: 2,   carbs_g: 2,   emoji: '🧀' },
  { name: 'Spinach',         serving_description: '1 cup (30g)',          calories: 7,   fat_g: 0.1,  protein_g: 0.9, carbs_g: 0.4, emoji: '🥬' },
  { name: 'Pepperoni',       serving_description: '1 oz (28g)',           calories: 138, fat_g: 12,   protein_g: 6,   carbs_g: 0,   emoji: '🍕' },
];

const insertIfMissing = db.prepare(`
  INSERT INTO foods (name, serving_description, calories, fat_g, protein_g, carbs_g, emoji)
  SELECT ?, ?, ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM foods WHERE name = ? AND created_by_user_id IS NULL
  )
`);
const seedAll = db.transaction((foods) => {
  for (const f of foods) {
    insertIfMissing.run(f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.emoji, f.name);
  }
});
seedAll(seedFoods);

module.exports = db;
