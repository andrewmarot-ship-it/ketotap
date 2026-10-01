const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Barcodes are 8–14 digits (EAN-8, UPC-A, EAN-13, GTIN-14). Returns null for "none", undefined if invalid.
function parseBarcode(v) {
  if (v === undefined || v === null || v === '') return null;
  const digits = String(v).replace(/\D/g, '');
  return /^\d{8,14}$/.test(digits) ? digits : undefined;
}

function parseFiber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Get all foods
router.get('/', (req, res) => {
  const foods = db.prepare('SELECT * FROM foods WHERE created_by_user_id = ? AND deleted_at IS NULL ORDER BY name ASC').all(req.user.id);
  res.json(foods);
});

// Get single food
router.get('/:id', (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });
  res.json(food);
});

// Create food
router.post('/', (req, res) => {
  const { name, serving_description, calories, fat_g, protein_g, carbs_g, emoji, fiber_g } = req.body;
  if (!name || !serving_description || calories == null || fat_g == null || protein_g == null || carbs_g == null) {
    return res.status(400).json({ error: 'name, serving_description, calories, fat_g, protein_g, carbs_g are required' });
  }
  const barcode = parseBarcode(req.body.barcode);
  if (barcode === undefined) return res.status(400).json({ error: 'Barcode must be 8 to 14 digits' });

  const result = db.prepare(`
    INSERT INTO foods (name, serving_description, calories, fat_g, protein_g, carbs_g, emoji, fiber_g, barcode, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, serving_description, parseInt(calories), parseFloat(fat_g), parseFloat(protein_g), parseFloat(carbs_g), emoji || '🍽️', parseFiber(fiber_g), barcode, req.user.id);

  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(food);
});

// Update food
router.put('/:id', (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ? AND created_by_user_id = ? AND deleted_at IS NULL').get(req.params.id, req.user.id);
  if (!food) return res.status(403).json({ error: 'Food not found or access denied' });

  const { name, serving_description, calories, fat_g, protein_g, carbs_g, emoji, fiber_g } = req.body;
  const barcode = req.body.barcode === undefined ? food.barcode : parseBarcode(req.body.barcode);
  if (barcode === undefined) return res.status(400).json({ error: 'Barcode must be 8 to 14 digits' });

  db.prepare(`
    UPDATE foods SET
      name = ?,
      serving_description = ?,
      calories = ?,
      fat_g = ?,
      protein_g = ?,
      carbs_g = ?,
      emoji = ?,
      fiber_g = ?,
      barcode = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || food.name,
    serving_description || food.serving_description,
    calories != null ? parseInt(calories) : food.calories,
    fat_g != null ? parseFloat(fat_g) : food.fat_g,
    protein_g != null ? parseFloat(protein_g) : food.protein_g,
    carbs_g != null ? parseFloat(carbs_g) : food.carbs_g,
    emoji != null ? emoji : food.emoji,
    fiber_g != null ? parseFiber(fiber_g) : food.fiber_g,
    barcode,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete food
router.delete('/:id', (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ? AND created_by_user_id = ? AND deleted_at IS NULL').get(req.params.id, req.user.id);
  if (!food) return res.status(403).json({ error: 'Food not found or access denied' });

  // Hide rather than delete: past logs keep pointing at this row so history totals don't change
  db.transaction(() => {
    db.prepare("UPDATE foods SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('DELETE FROM meal_preset_items WHERE food_id = ?').run(req.params.id);
  })();
  res.json({ message: 'Food deleted' });
});

module.exports = router;
