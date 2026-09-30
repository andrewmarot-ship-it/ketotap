// Limits (net carbs, calories) should not be exceeded; goals (fat, protein) should be reached.
export const MACROS = {
  carbs:    { field: 'carbs_g',   target: 'carbs_g',   type: 'limit', label: 'net carbs', noun: 'net carb', unit: 'g',    emoji: '🥦' },
  calories: { field: 'calories',  target: 'calories',  type: 'limit', label: 'calories',  noun: 'calorie',  unit: 'kcal', emoji: '🔥' },
  fat:      { field: 'fat_g',     target: 'fat_g',     type: 'goal',  label: 'fat',       unit: 'g',    emoji: '🧈' },
  protein:  { field: 'protein_g', target: 'protein_g', type: 'goal',  label: 'protein',   unit: 'g',    emoji: '🥩' },
};

export const BANNER_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = { carbs: 0.75, calories: 0.85 };

const r1 = v => Math.round(v * 10) / 10;

export function formatAmount(key, value) {
  const v = key === 'calories' ? Math.round(value) : r1(value);
  return `${v.toLocaleString()}${key === 'calories' ? ' kcal' : ' g'}`;
}

export function computeTotals(logs) {
  return logs.reduce((acc, log) => {
    const m = (log.servings ?? 1) * (log.portion_multiplier ?? 1);
    return {
      calories:  acc.calories  + log.calories  * m,
      fat_g:     acc.fat_g     + log.fat_g     * m,
      protein_g: acc.protein_g + log.protein_g * m,
      carbs_g:   acc.carbs_g   + log.carbs_g   * m,
    };
  }, { calories: 0, fat_g: 0, protein_g: 0, carbs_g: 0 });
}

// Alerts for any macro at 85%+ of target, most urgent first:
// over a limit → near a limit (carbs before calories) → near a goal → goal reached
export function computeAlerts(totals, targets) {
  if (!targets) return [];
  const alerts = [];
  for (const [key, m] of Object.entries(MACROS)) {
    const target = targets[m.target];
    if (!target) continue;
    const current = totals[m.field];
    const pct = current / target;
    let kind = null;
    if (m.type === 'limit') {
      if (current > target) kind = 'over';
      else if (pct >= BANNER_THRESHOLD) kind = 'limit';
    } else if (current >= target) kind = 'done';
    else if (pct >= BANNER_THRESHOLD) kind = 'goal';
    if (kind) alerts.push({ key, kind, current, target, pct, remaining: target - current });
  }
  const rank = { over: 0, limit: 1, goal: 2, done: 3 };
  const order = ['carbs', 'calories', 'fat', 'protein'];
  return alerts.sort((a, b) => rank[a.kind] - rank[b.kind] || order.indexOf(a.key) - order.indexOf(b.key));
}

// Foods whose single serving would push net carbs or calories past the limit, with a short reason
export function computeBlocked(foods, totals, targets) {
  const blocked = new Map();
  if (!targets) return blocked;
  const carbsLeft = targets.carbs_g - totals.carbs_g;
  const calLeft = targets.calories - totals.calories;
  for (const f of foods) {
    const overCarbs = f.carbs_g > 0 && f.carbs_g > carbsLeft + 1e-9;
    const overCal = f.calories > 0 && f.calories > calLeft + 1e-9;
    if (overCarbs) blocked.set(f.id, `+${r1(f.carbs_g)} g carbs`);
    else if (overCal) blocked.set(f.id, `+${Math.round(f.calories)} kcal`);
  }
  return blocked;
}

// Glow up to 3 foods that fit both limits and help most with fat (2x weight) and protein,
// once carbs or calories are getting close
export function computeRecommended(foods, totals, targets, blocked) {
  if (!targets) return new Set();
  const nearLimit = totals.carbs_g / targets.carbs_g >= SUGGEST_THRESHOLD.carbs
    || totals.calories / targets.calories >= SUGGEST_THRESHOLD.calories;
  if (!nearLimit) return new Set();
  const fatLeft = Math.max(0, targets.fat_g - totals.fat_g);
  const proteinLeft = Math.max(0, targets.protein_g - totals.protein_g);
  const scored = foods
    .filter(f => !blocked.has(f.id))
    .map(f => {
      const fatScore = fatLeft > 0 ? Math.min(f.fat_g / fatLeft, 1) : 0;
      const proteinScore = proteinLeft > 0 ? Math.min(f.protein_g / proteinLeft, 1) : 0;
      return { id: f.id, score: fatScore * 2 + proteinScore };
    })
    .filter(f => f.score > 0.1)
    .sort((a, b) => b.score - a.score);
  return new Set(scored.slice(0, 3).map(f => f.id));
}

// For a goal alert: one of the user's foods (1 or 2 servings) that fits the remaining carbs and
// calories and covers, or nearly covers, what's left of the goal
export function suggestFoodForGoal(alert, foods, totals, targets) {
  const field = MACROS[alert.key].field;
  const need = alert.remaining;
  if (need <= 0) return null;
  const carbsLeft = targets.carbs_g - totals.carbs_g;
  const calLeft = targets.calories - totals.calories;

  let best = null;
  for (const food of foods) {
    const per = food[field];
    if (!per || per <= 0) continue;
    for (const n of [1, 2]) {
      if (food.carbs_g * n > carbsLeft || food.calories * n > calLeft) break;
      const amount = per * n;
      const covers = amount >= need;
      if (!covers && amount < need * 0.6) continue;
      // Tiers: one serving that covers it without overshooting much, one serving that gets 80%+
      // of the way, two servings that do the same, any cover, then anything close.
      // Within a tier: least overshoot, fewer carbs.
      const neat = covers && amount <= need * 1.75;
      const tier = n === 1 && neat ? 0 : n === 1 && !covers && amount >= need * 0.8 ? 1 : neat ? 2 : covers ? 3 : 4;
      const score = tier * 1000 + Math.abs(amount - need) + food.carbs_g * 0.1;
      if (!best || score < best.score) best = { food, servings: n, covers, score };
      if (covers) break;
    }
  }
  return best;
}

export function describeAlert(alert, { suggestion, blockedCount } = {}) {
  const m = MACROS[alert.key];
  const pctText = `${Math.round(alert.pct * 100)}%`;
  switch (alert.kind) {
    case 'over':
      return {
        title: `${formatAmount(alert.key, alert.current - alert.target)} over your ${m.noun} limit`,
        detail: blockedCount ? 'Foods that would add more are greyed out' : `${formatAmount(alert.key, alert.current)} of ${formatAmount(alert.key, alert.target)} today`,
        pill: 'Over',
      };
    case 'limit':
      return {
        title: `${formatAmount(alert.key, alert.remaining)} ${m.label} left today`,
        detail: blockedCount ? 'Greyed-out foods would put you over' : `You're at ${pctText} of your limit`,
        pill: 'Limit',
      };
    case 'goal': {
      let detail = `You're at ${pctText} of your goal`;
      if (suggestion) {
        const who = `${suggestion.food.emoji || ''} ${suggestion.servings === 2 ? '2 × ' : ''}${suggestion.food.name}`.trim();
        detail = `Nearly there. ${who} would ${suggestion.covers ? 'cover it' : 'get you close'}.`;
      }
      return { title: `${formatAmount(alert.key, alert.remaining)} to reach your ${m.label} goal`, detail, pill: 'Goal' };
    }
    default:
      return {
        title: `${m.label[0].toUpperCase()}${m.label.slice(1)} goal reached`,
        detail: `${formatAmount(alert.key, alert.current)} of ${formatAmount(alert.key, alert.target)} today`,
        pill: 'Done',
      };
  }
}

// Warning text if logging one serving of these macros would exceed net carbs or calories
export function limitWarning(macros, totals, targets) {
  if (!targets) return null;
  const carbsOver = totals.carbs_g + (macros.carbs_g || 0) - targets.carbs_g;
  const calOver = totals.calories + (macros.calories || 0) - targets.calories;
  if (macros.carbs_g > 0 && carbsOver > 0) return `Logging this puts you ${formatAmount('carbs', carbsOver)} over your net carb limit.`;
  if (macros.calories > 0 && calOver > 0) return `Logging this puts you ${formatAmount('calories', calOver)} over your calorie limit.`;
  return null;
}
