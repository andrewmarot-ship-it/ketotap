/**
 * Apply a portion multiplier to a set of base (1×) macro values.
 * Gram values are rounded to 1 decimal place; calories to the nearest integer.
 *
 * @param {{ fat_g: number, protein_g: number, carbs_g: number, calories: number }} base
 * @param {0.5 | 1 | 2} multiplier
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
