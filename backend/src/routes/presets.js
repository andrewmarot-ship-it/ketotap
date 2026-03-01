const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const ITEMS_QUERY = `
  SELECT pi.id, pi.food_id, pi.servings,
         f.name AS food_name, f.emoji AS food_emoji,
         f.calories, f.fat_g, f.protein_g, f.carbs_g,
         f.serving_description
  FROM meal_preset_items pi
  JOIN foods f ON f.id = pi.food_id
  WHERE pi.preset_id = ?
`;

// GET /api/presets — list user's presets with items
router.get('/', auth, (req, res) => {
  const presets = db.prepare(`
    SELECT id, name, emoji, created_at
    FROM meal_presets
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  for (const preset of presets) {
    preset.items = db.prepare(ITEMS_QUERY).all(preset.id);
  }

  res.json(presets);
});

// POST /api/presets — create a preset
router.post('/', auth, (req, res) => {
  const { name, emoji, items } = req.body;
  if (!name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'name and at least one item required' });
  }

  const insertPreset = db.prepare(
    `INSERT INTO meal_presets (user_id, name, emoji) VALUES (?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO meal_preset_items (preset_id, food_id, servings) VALUES (?, ?, ?)`
  );

  const presetId = db.transaction(() => {
    const { lastInsertRowid } = insertPreset.run(req.user.id, name.trim(), emoji || '🍱');
    for (const item of items) {
      insertItem.run(lastInsertRowid, item.food_id, item.servings || 1);
    }
    return lastInsertRowid;
  })();

  const preset = db.prepare(
    `SELECT id, name, emoji, created_at FROM meal_presets WHERE id = ?`
  ).get(presetId);
  preset.items = db.prepare(ITEMS_QUERY).all(presetId);

  res.status(201).json(preset);
});

// DELETE /api/presets/:id
router.delete('/:id', auth, (req, res) => {
  const preset = db.prepare(
    `SELECT id FROM meal_presets WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  db.prepare(`DELETE FROM meal_presets WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Deleted' });
});

// POST /api/presets/:id/log — log all preset items for today (or given date)
router.post('/:id/log', auth, (req, res) => {
  const preset = db.prepare(
    `SELECT id FROM meal_presets WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  const items = db.prepare(
    `SELECT food_id, servings FROM meal_preset_items WHERE preset_id = ?`
  ).all(req.params.id);

  const date = req.body.date || new Date().toLocaleDateString('en-CA');

  const getExisting = db.prepare(
    `SELECT id FROM daily_logs WHERE user_id = ? AND date = ? AND food_id = ?`
  );
  const increment = db.prepare(
    `UPDATE daily_logs SET servings = servings + ?, timestamp = datetime('now') WHERE id = ?`
  );
  const insert = db.prepare(
    `INSERT INTO daily_logs (user_id, date, food_id, servings) VALUES (?, ?, ?, ?)`
  );

  db.transaction(() => {
    for (const item of items) {
      const row = getExisting.get(req.user.id, date, item.food_id);
      if (row) {
        increment.run(item.servings, row.id);
      } else {
        insert.run(req.user.id, date, item.food_id, item.servings);
      }
    }
  })();

  res.json({ message: 'Logged', count: items.length });
});

module.exports = router;
