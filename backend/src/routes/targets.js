const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get targets
router.get('/', (req, res) => {
  let targets = db.prepare('SELECT * FROM targets WHERE user_id = ?').get(req.user.id);
  if (!targets) {
    db.prepare('INSERT INTO targets (user_id, calories, fat_g, protein_g, carbs_g) VALUES (?, 2000, 150, 100, 20)').run(req.user.id);
    targets = db.prepare('SELECT * FROM targets WHERE user_id = ?').get(req.user.id);
  }
  res.json(targets);
});

// Parse an optional positive integer goal; null means "keep existing"
function optionalGoal(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

// Update targets
router.put('/', (req, res) => {
  const { calories, fat_g, protein_g, carbs_g } = req.body;
  if (!calories || !fat_g || !protein_g || !carbs_g) {
    return res.status(400).json({ error: 'All macro targets are required' });
  }

  const water_ml     = optionalGoal(req.body.water_ml);
  const sodium_mg    = optionalGoal(req.body.sodium_mg);
  const potassium_mg = optionalGoal(req.body.potassium_mg);
  const magnesium_mg = optionalGoal(req.body.magnesium_mg);
  if ([water_ml, sodium_mg, potassium_mg, magnesium_mg].some(Number.isNaN)) {
    return res.status(400).json({ error: 'Water and electrolyte goals must be positive numbers' });
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

  db.prepare(`
    UPDATE targets SET
      water_ml     = COALESCE(?, water_ml),
      sodium_mg    = COALESCE(?, sodium_mg),
      potassium_mg = COALESCE(?, potassium_mg),
      magnesium_mg = COALESCE(?, magnesium_mg)
    WHERE user_id = ?
  `).run(water_ml, sodium_mg, potassium_mg, magnesium_mg, req.user.id);

  const targets = db.prepare('SELECT * FROM targets WHERE user_id = ?').get(req.user.id);
  res.json(targets);
});

module.exports = router;
