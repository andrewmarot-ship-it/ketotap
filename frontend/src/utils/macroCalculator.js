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
