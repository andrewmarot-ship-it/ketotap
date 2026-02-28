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
  ['Avocado',       '🥑'],
  ['Eggs',          '🥚'],
  ['Bacon',         '🥓'],
  ['Salmon',        '🐟'],
  ['Cheddar Cheese','🧀'],
  ['Butter',        '🧈'],
  ['Ground Beef',   '🥩'],
  ['Broccoli',      '🥦'],
  ['Almonds',       '🌰'],
  ['Heavy Cream',   '🥛'],
  ['Chicken Thigh', '🍗'],
  ['Olive Oil',     '🫒'],
];

const updateEmoji = db.prepare(
  "UPDATE foods SET emoji = ?, image_url = NULL WHERE name = ? AND created_by_user_id IS NULL AND emoji = '🍽️'"
);
for (const [name, emoji] of defaultFoodEmojis) {
  updateEmoji.run(emoji, name);
}

// Seed default keto foods if none exist
const foodCount = db.prepare('SELECT COUNT(*) as count FROM foods').get();
if (foodCount.count === 0) {
  const seedFoods = [
    { name: 'Avocado',       serving_description: '1 whole (200g)',   calories: 320, fat_g: 29,   protein_g: 4,   carbs_g: 2,   emoji: '🥑' },
    { name: 'Eggs',          serving_description: '2 large eggs',     calories: 140, fat_g: 10,   protein_g: 12,  carbs_g: 1,   emoji: '🥚' },
    { name: 'Bacon',         serving_description: '3 slices (45g)',   calories: 180, fat_g: 14,   protein_g: 12,  carbs_g: 0,   emoji: '🥓' },
    { name: 'Salmon',        serving_description: '1 fillet (150g)',  calories: 280, fat_g: 18,   protein_g: 28,  carbs_g: 0,   emoji: '🐟' },
    { name: 'Cheddar Cheese',serving_description: '1 oz (28g)',       calories: 115, fat_g: 9,    protein_g: 7,   carbs_g: 0.4, emoji: '🧀' },
    { name: 'Butter',        serving_description: '1 tbsp (14g)',     calories: 100, fat_g: 11,   protein_g: 0.1, carbs_g: 0,   emoji: '🧈' },
    { name: 'Ground Beef',   serving_description: '4 oz (113g)',      calories: 300, fat_g: 23,   protein_g: 22,  carbs_g: 0,   emoji: '🥩' },
    { name: 'Broccoli',      serving_description: '1 cup (90g)',      calories: 55,  fat_g: 0.6,  protein_g: 3.7, carbs_g: 6,   emoji: '🥦' },
    { name: 'Almonds',       serving_description: '1 oz (28g)',       calories: 164, fat_g: 14,   protein_g: 6,   carbs_g: 2.5, emoji: '🌰' },
    { name: 'Heavy Cream',   serving_description: '2 tbsp (30ml)',    calories: 100, fat_g: 11,   protein_g: 0.6, carbs_g: 0.8, emoji: '🥛' },
    { name: 'Chicken Thigh', serving_description: '1 thigh (100g)',   calories: 209, fat_g: 13,   protein_g: 22,  carbs_g: 0,   emoji: '🍗' },
    { name: 'Olive Oil',     serving_description: '1 tbsp (14g)',     calories: 119, fat_g: 13.5, protein_g: 0,   carbs_g: 0,   emoji: '🫒' },
  ];

  const insert = db.prepare(`
    INSERT INTO foods (name, serving_description, calories, fat_g, protein_g, carbs_g, emoji)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((foods) => {
    for (const f of foods) {
      insert.run(f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.emoji);
    }
  });
  insertMany(seedFoods);
}

module.exports = db;
