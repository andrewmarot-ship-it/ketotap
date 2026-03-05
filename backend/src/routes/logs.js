const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get daily log for a date (default today)
router.get('/', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const logs = db.prepare(`
    SELECT dl.id, dl.food_id, dl.servings, dl.timestamp,
           f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.image_url
    FROM daily_logs dl
    JOIN foods f ON dl.food_id = f.id
    WHERE dl.user_id = ? AND dl.date = ?
    ORDER BY dl.timestamp ASC
  `).all(req.user.id, date);

  res.json(logs);
});

// Get history - list of dates with totals (optionally filtered by month YYYY-MM)
router.get('/history', (req, res) => {
  const { month } = req.query;

  const params = [req.user.id, req.user.id];
  let monthFilter = '';

  if (month) {
    monthFilter = 'AND dl.date LIKE ?';
    params.push(`${month}-%`);
  }

  const history = db.prepare(`
    SELECT dl.date,
           SUM(f.calories * dl.servings) as calories,
           SUM(f.fat_g * dl.servings) as fat_g,
           SUM(f.protein_g * dl.servings) as protein_g,
           SUM(f.carbs_g * dl.servings) as carbs_g,
           COUNT(DISTINCT dl.id) as entries,
           CASE WHEN cd.date IS NOT NULL THEN 1 ELSE 0 END as completed
    FROM daily_logs dl
    JOIN foods f ON dl.food_id = f.id
    LEFT JOIN completed_days cd ON cd.user_id = ? AND cd.date = dl.date
    WHERE dl.user_id = ? ${monthFilter}
    GROUP BY dl.date
    ORDER BY dl.date DESC
    ${month ? '' : 'LIMIT 90'}
  `).all(...params);

  res.json(history);
});

// Get a specific historical day detail
router.get('/history/:date', (req, res) => {
  const logs = db.prepare(`
    SELECT dl.id, dl.food_id, dl.servings, dl.timestamp,
           f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.image_url
    FROM daily_logs dl
    JOIN foods f ON dl.food_id = f.id
    WHERE dl.user_id = ? AND dl.date = ?
    ORDER BY dl.timestamp ASC
  `).all(req.user.id, req.params.date);

  res.json(logs);
});

// Toggle a day as complete/incomplete
router.post('/complete', (req, res) => {
  const { date } = req.body;
  const logDate = date || new Date().toISOString().split('T')[0];

  const existing = db.prepare('SELECT id FROM completed_days WHERE user_id = ? AND date = ?').get(req.user.id, logDate);

  if (existing) {
    db.prepare('DELETE FROM completed_days WHERE user_id = ? AND date = ?').run(req.user.id, logDate);
    return res.json({ date: logDate, completed: false });
  }

  db.prepare('INSERT INTO completed_days (user_id, date) VALUES (?, ?)').run(req.user.id, logDate);
  res.json({ date: logDate, completed: true });
});

// Get completion status for a specific date
router.get('/complete/:date', (req, res) => {
  const row = db.prepare('SELECT id FROM completed_days WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  res.json({ date: req.params.date, completed: !!row });
});

// Add food to log (tap)
router.post('/', (req, res) => {
  const { food_id, servings = 1, date } = req.body;
  if (!food_id) return res.status(400).json({ error: 'food_id is required' });

  const food = db.prepare('SELECT id FROM foods WHERE id = ?').get(food_id);
  if (!food) return res.status(404).json({ error: 'Food not found' });

  const logDate = date || new Date().toISOString().split('T')[0];

  // Check if there's already an entry for this food today, and increment servings
  const existing = db.prepare('SELECT id, servings FROM daily_logs WHERE user_id = ? AND date = ? AND food_id = ?').get(req.user.id, logDate, food_id);

  let logId;
  if (existing) {
    db.prepare(`UPDATE daily_logs SET servings = servings + ?, timestamp = datetime('now') WHERE id = ?`).run(parseInt(servings), existing.id);
    logId = existing.id;
  } else {
    const result = db.prepare('INSERT INTO daily_logs (user_id, date, food_id, servings) VALUES (?, ?, ?, ?)').run(req.user.id, logDate, food_id, parseInt(servings));
    logId = result.lastInsertRowid;
  }

  const log = db.prepare(`
    SELECT dl.id, dl.food_id, dl.servings, dl.timestamp,
           f.name, f.serving_description, f.calories, f.fat_g, f.protein_g, f.carbs_g, f.image_url
    FROM daily_logs dl
    JOIN foods f ON dl.food_id = f.id
    WHERE dl.id = ?
  `).get(logId);

  res.status(201).json(log);
});

// Clear all log entries for a date
router.delete('/', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  db.prepare('DELETE FROM daily_logs WHERE user_id = ? AND date = ?').run(req.user.id, date);
  res.json({ message: 'Day cleared', date });
});

// Remove one serving or delete entry
router.delete('/complete/:date', (req, res) => {
  db.prepare('DELETE FROM completed_days WHERE user_id = ? AND date = ?').run(req.user.id, req.params.date);
  res.json({ date: req.params.date, completed: false });
});

router.delete('/:id', (req, res) => {
  const log = db.prepare('SELECT * FROM daily_logs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!log) return res.status(404).json({ error: 'Log entry not found' });

  if (log.servings > 1) {
    db.prepare('UPDATE daily_logs SET servings = servings - 1 WHERE id = ?').run(req.params.id);
  } else {
    db.prepare('DELETE FROM daily_logs WHERE id = ?').run(req.params.id);
  }

  res.json({ message: 'Serving removed', deleted: log.servings === 1 });
});

module.exports = router;
