const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get targets
router.get('/', (req, res) => {
  const targets = db.prepare('SELECT * FROM targets WHERE user_id = ?').get(req.user.id);
  if (!targets) {
    const result = db.prepare('INSERT INTO targets (user_id, calories, fat_g, protein_g, carbs_g) VALUES (?, 2000, 150, 100, 20)').run(req.user.id);
    return res.json({ id: result.lastInsertRowid, user_id: req.user.id, calories: 2000, fat_g: 150, protein_g: 100, carbs_g: 20 });
  }
  res.json(targets);
});

// Update targets
router.put('/', (req, res) => {
  const { calories, fat_g, protein_g, carbs_g } = req.body;
  if (!calories || !fat_g || !protein_g || !carbs_g) {
    return res.status(400).json({ error: 'All macro targets are required' });
  }

  db.prepare(`
    INSERT INTO targets (user_id, calories, fat_g, protein_g, carbs_g)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      calories = excluded.calories,
      fat_g = excluded.fat_g,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g
  `).run(req.user.id, parseInt(calories), parseFloat(fat_g), parseFloat(protein_g), parseFloat(carbs_g));

  const targets = db.prepare('SELECT * FROM targets WHERE user_id = ?').get(req.user.id);
  res.json(targets);
});

module.exports = router;
