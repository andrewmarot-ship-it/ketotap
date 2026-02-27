const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get all foods
router.get('/', (req, res) => {
  const foods = db.prepare('SELECT * FROM foods ORDER BY name ASC').all();
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
  const { name, serving_description, calories, fat_g, protein_g, carbs_g, image_url } = req.body;
  if (!name || !serving_description || calories == null || fat_g == null || protein_g == null || carbs_g == null) {
    return res.status(400).json({ error: 'name, serving_description, calories, fat_g, protein_g, carbs_g are required' });
  }

  const result = db.prepare(`
    INSERT INTO foods (name, serving_description, calories, fat_g, protein_g, carbs_g, image_url, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, serving_description, parseInt(calories), parseFloat(fat_g), parseFloat(protein_g), parseFloat(carbs_g), image_url || null, req.user.id);

  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(food);
});

// Update food
router.put('/:id', (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });

  const { name, serving_description, calories, fat_g, protein_g, carbs_g, image_url } = req.body;

  db.prepare(`
    UPDATE foods SET
      name = ?,
      serving_description = ?,
      calories = ?,
      fat_g = ?,
      protein_g = ?,
      carbs_g = ?,
      image_url = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || food.name,
    serving_description || food.serving_description,
    calories != null ? parseInt(calories) : food.calories,
    fat_g != null ? parseFloat(fat_g) : food.fat_g,
    protein_g != null ? parseFloat(protein_g) : food.protein_g,
    carbs_g != null ? parseFloat(carbs_g) : food.carbs_g,
    image_url !== undefined ? image_url : food.image_url,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete food
router.delete('/:id', (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });

  db.prepare('DELETE FROM foods WHERE id = ?').run(req.params.id);
  res.json({ message: 'Food deleted' });
});

module.exports = router;
