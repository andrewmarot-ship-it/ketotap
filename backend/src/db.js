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

  CREATE TABLE IF NOT EXISTS meal_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🍱',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meal_preset_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL,
    food_id INTEGER NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (preset_id) REFERENCES meal_presets(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
  );
`);

// Add emoji column if it doesn't exist yet (safe to run every startup)
try {
  db.exec("ALTER TABLE foods ADD COLUMN emoji TEXT NOT NULL DEFAULT '🍽️'");
} catch (_) { /* column already exists */ }

// ── Default food list ────────────────────────────────────────────────────────
const seedFoods = [
  { name: 'Olive Oil',                      serving_description: '1 tbsp (14 g)',           calories: 119, fat_g: 13.5, carbs_g: 0,   protein_g: 0,   emoji: '🫒' },
  { name: 'Coconut Oil',                    serving_description: '1 tbsp (14 g)',           calories: 121, fat_g: 13.5, carbs_g: 0,   protein_g: 0,   emoji: '🥥' },
  { name: 'Unsalted Butter',                serving_description: '1 tbsp (14 g)',           calories: 102, fat_g: 11.5, carbs_g: 0,   protein_g: 0.1, emoji: '🧈' },
  { name: 'Heavy Cream (35%)',              serving_description: '1 tbsp (15 ml)',          calories: 51,  fat_g: 5.4,  carbs_g: 0.4, protein_g: 0.3, emoji: '🥛' },
  { name: 'Roasted Salted Almonds',         serving_description: '⅓ cup (~47 g)',           calories: 277, fat_g: 24,   carbs_g: 8,   protein_g: 10,  emoji: '🌰' },
  { name: 'Chia Seeds',                     serving_description: '1 tbsp (12 g)',           calories: 58,  fat_g: 3.7,  carbs_g: 5,   protein_g: 2,   emoji: '🌱' },
  { name: 'Hemp Seeds',                     serving_description: '1 tbsp (10 g)',           calories: 55,  fat_g: 3.5,  carbs_g: 0.8, protein_g: 3.2, emoji: '🌿' },
  { name: 'Almond Butter',                  serving_description: '1 tbsp (16 g)',           calories: 98,  fat_g: 9,    carbs_g: 3,   protein_g: 3.4, emoji: '🌰' },
  { name: 'Chicken Breast',                 serving_description: '1 breast (~174 g)',       calories: 284, fat_g: 6.2,  carbs_g: 0,   protein_g: 53,  emoji: '🍗' },
  { name: 'Salmon Fillet',                  serving_description: '1 fillet (~198 g)',       calories: 412, fat_g: 27,   carbs_g: 0,   protein_g: 40,  emoji: '🐟' },
  { name: 'Canned Tuna (drained)',          serving_description: '1 can (~165 g)',          calories: 191, fat_g: 1.4,  carbs_g: 0,   protein_g: 42,  emoji: '🐟' },
  { name: 'Egg',                            serving_description: '1 large (50 g)',          calories: 72,  fat_g: 4.8,  carbs_g: 0.4, protein_g: 6.3, emoji: '🥚' },
  { name: 'Bacon Strip',                    serving_description: '1 strip, cooked (~8 g)', calories: 43,  fat_g: 3.3,  carbs_g: 0.1, protein_g: 3,   emoji: '🥓' },
  { name: 'Marble Cheese (shredded)',       serving_description: '⅓ cup (~38 g)',           calories: 150, fat_g: 12,   carbs_g: 0.4, protein_g: 10,  emoji: '🧀' },
  { name: 'Greek Yogurt (plain, full-fat)', serving_description: '⅓ cup (~85 g)',           calories: 83,  fat_g: 4,    carbs_g: 4.8, protein_g: 7,   emoji: '🍶' },
  { name: 'Avocado',                        serving_description: '½ avocado (~100 g)',      calories: 160, fat_g: 14.7, carbs_g: 8.5, protein_g: 2,   emoji: '🥑' },
  { name: 'Broccoli',                       serving_description: '1 cup, chopped (~91 g)', calories: 31,  fat_g: 0.3,  carbs_g: 6,   protein_g: 2.6, emoji: '🥦' },
  { name: 'Red Bell Pepper',                serving_description: '1 cup, sliced (~92 g)',  calories: 39,  fat_g: 0.4,  carbs_g: 9,   protein_g: 1.3, emoji: '🫑' },
  { name: 'Zucchini',                       serving_description: '1 cup, sliced (~113 g)', calories: 20,  fat_g: 0.4,  carbs_g: 3.5, protein_g: 1.5, emoji: '🥒' },
  { name: 'Lindt 85% Dark Chocolate',       serving_description: '1 square (~10 g)',        calories: 57,  fat_g: 4.5,  carbs_g: 4,   protein_g: 1,   emoji: '🍫' },
];

// Full replacement of global (seeded) foods on every startup:
//   1. Remove global foods not in the new list (cascades to daily_logs)
//   2. Update globals that exist but may have changed portions/macros
//   3. Insert new globals that don't exist yet
const newNames = seedFoods.map(f => f.name);
const placeholders = newNames.map(() => '?').join(',');

const replaceSeeds = db.transaction((foods) => {
  db.prepare(`DELETE FROM foods WHERE created_by_user_id IS NULL AND name NOT IN (${placeholders})`).run(...newNames);

  const update = db.prepare(`
    UPDATE foods SET serving_description=?, calories=?, fat_g=?, carbs_g=?, protein_g=?, emoji=?
    WHERE name=? AND created_by_user_id IS NULL
  `);
  const insert = db.prepare(`
    INSERT INTO foods (name, serving_description, calories, fat_g, carbs_g, protein_g, emoji)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name=? AND created_by_user_id IS NULL)
  `);
  for (const f of foods) {
    update.run(f.serving_description, f.calories, f.fat_g, f.carbs_g, f.protein_g, f.emoji, f.name);
    insert.run(f.name, f.serving_description, f.calories, f.fat_g, f.carbs_g, f.protein_g, f.emoji, f.name);
  }
});
replaceSeeds(seedFoods);

module.exports = db;
