const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Amount added per tap, per kind
const STEPS = { water: 250, sodium: 500, potassium: 350, magnesium: 100 };

function totalsFor(userId, date) {
  const rows = db.prepare(
    'SELECT kind, SUM(amount) AS total FROM daily_intake WHERE user_id = ? AND date = ? GROUP BY kind'
  ).all(userId, date);
  const totals = { water: 0, sodium: 0, potassium: 0, magnesium: 0 };
  for (const r of rows) if (r.kind in totals) totals[r.kind] = r.total;
  return totals;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

router.get('/', (req, res) => {
  res.json(totalsFor(req.user.id, req.query.date || todayStr()));
});

router.post('/', (req, res) => {
  const { kind } = req.body;
  const date = req.body.date || todayStr();
  if (!(kind in STEPS)) return res.status(400).json({ error: 'Invalid kind' });

  db.prepare('INSERT INTO daily_intake (user_id, date, kind, amount) VALUES (?, ?, ?, ?)')
    .run(req.user.id, date, kind, STEPS[kind]);
  res.status(201).json(totalsFor(req.user.id, date));
});

// Undo the most recent tap for a kind on a date
router.delete('/last', (req, res) => {
  const { kind } = req.query;
  const date = req.query.date || todayStr();
  if (!(kind in STEPS)) return res.status(400).json({ error: 'Invalid kind' });

  const last = db.prepare(
    'SELECT id FROM daily_intake WHERE user_id = ? AND date = ? AND kind = ? ORDER BY id DESC LIMIT 1'
  ).get(req.user.id, date, kind);
  if (last) db.prepare('DELETE FROM daily_intake WHERE id = ?').run(last.id);
  res.json(totalsFor(req.user.id, date));
});

module.exports = router;
