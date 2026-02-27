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
`);

// Seed default keto foods if none exist
const foodCount = db.prepare('SELECT COUNT(*) as count FROM foods').get();
if (foodCount.count === 0) {
  const seedFoods = [
    { name: 'Avocado', serving_description: '1 whole (200g)', calories: 320, fat_g: 29, protein_g: 4, carbs_g: 2, image_url: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=200&h=200&fit=crop' },
    { name: 'Eggs', serving_description: '2 large eggs', calories: 140, fat_g: 10, protein_g: 12, carbs_g: 1, image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=200&h=200&fit=crop' },
    { name: 'Bacon', serving_description: '3 slices (45g)', calories: 180, fat_g: 14, protein_g: 12, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1606851094369-8c12e3c28eff?w=200&h=200&fit=crop' },
    { name: 'Salmon', serving_description: '1 fillet (150g)', calories: 280, fat_g: 18, protein_g: 28, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=200&fit=crop' },
    { name: 'Cheddar Cheese', serving_description: '1 oz (28g)', calories: 115, fat_g: 9, protein_g: 7, carbs_g: 0.4, image_url: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=200&h=200&fit=crop' },
    { name: 'Butter', serving_description: '1 tbsp (14g)', calories: 100, fat_g: 11, protein_g: 0.1, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=200&h=200&fit=crop' },
    { name: 'Ground Beef', serving_description: '4 oz (113g)', calories: 300, fat_g: 23, protein_g: 22, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=200&h=200&fit=crop' },
    { name: 'Broccoli', serving_description: '1 cup (90g)', calories: 55, fat_g: 0.6, protein_g: 3.7, carbs_g: 6, image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=200&h=200&fit=crop' },
    { name: 'Almonds', serving_description: '1 oz (28g)', calories: 164, fat_g: 14, protein_g: 6, carbs_g: 2.5, image_url: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=200&h=200&fit=crop' },
    { name: 'Heavy Cream', serving_description: '2 tbsp (30ml)', calories: 100, fat_g: 11, protein_g: 0.6, carbs_g: 0.8, image_url: 'https://images.unsplash.com/photo-1587377838536-70e5b0e6f1cd?w=200&h=200&fit=crop' },
    { name: 'Chicken Thigh', serving_description: '1 thigh (100g)', calories: 209, fat_g: 13, protein_g: 22, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=200&h=200&fit=crop' },
    { name: 'Olive Oil', serving_description: '1 tbsp (14g)', calories: 119, fat_g: 13.5, protein_g: 0, carbs_g: 0, image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&h=200&fit=crop' },
  ];

  const insert = db.prepare(`
    INSERT INTO foods (name, serving_description, calories, fat_g, protein_g, carbs_g, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((foods) => {
    for (const f of foods) {
      insert.run(f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.image_url);
    }
  });
  insertMany(seedFoods);
}

module.exports = db;
