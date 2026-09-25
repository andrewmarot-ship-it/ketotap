/**
 * Apply a portion multiplier to a set of base (1×) macro values.
 * Gram values are rounded to 1 decimal place; calories to the nearest integer.
 *
 * @param {{ fat_g: number, protein_g: number, carbs_g: number, calories: number }} base
 * @param {number} multiplier
 * @returns {{ fat_g: number, protein_g: number, carbs_g: number, calories: number }}
 */
export function applyMultiplier(base, multiplier) {
  return {
    fat_g:     Math.round(base.fat_g     * multiplier * 10) / 10,
    protein_g: Math.round(base.protein_g * multiplier * 10) / 10,
    carbs_g:   Math.round(base.carbs_g   * multiplier * 10) / 10,
    calories:  Math.round(base.calories  * multiplier),
  };
}

const QUARTERS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

// 1.5 -> "1½", 0.25 -> "¼", 2 -> "2". Amounts off the quarter grid fall back to one decimal.
export function formatPortion(n) {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  if (frac === 0) return String(whole);
  const glyph = QUARTERS[frac];
  if (!glyph) return String(Math.round(n * 10) / 10);
  return whole === 0 ? glyph : `${whole}${glyph}`;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// 0–100 score for how keto the food logged so far is. Measures proportions, not
// quantity, so it doesn't sit low early in the day. Returns null when nothing is logged.
//   Net carbs  (50 pts): full while at or under the limit, down to 0 at 2x the limit.
//   Fat share  (30 pts): full at 65%+ of macro calories, down to 0 at 40%.
//   Protein    (20 pts): full between 15% and 35% of macro calories, -1 per point outside.
export function ketoScore(totals, targets) {
  const fatKcal = totals.fat_g * 9;
  const proteinKcal = totals.protein_g * 4;
  const carbKcal = totals.carbs_g * 4;
  const macroKcal = fatKcal + proteinKcal + carbKcal;
  if (macroKcal <= 0 || !targets) return null;

  const limit = targets.carbs_g || 20;
  const carbPts = 50 * clamp01(1 - (totals.carbs_g - limit) / limit);

  const fatShare = fatKcal / macroKcal;
  const fatPts = 30 * clamp01((fatShare - 0.4) / 0.25);

  const proteinPct = (proteinKcal / macroKcal) * 100;
  const outside = proteinPct < 15 ? 15 - proteinPct : proteinPct > 35 ? proteinPct - 35 : 0;
  const proteinPts = Math.max(0, 20 - outside);

  return Math.round(carbPts + fatPts + proteinPts);
}
