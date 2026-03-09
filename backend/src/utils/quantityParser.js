/**
 * Parses a quantity string like "1 tbsp", "half cup", "2 oz", "100g"
 * into a structured object for nutrition scaling.
 *
 * Returns: { amount, unit, type, grams?, portionUnit? }
 * Throws an object with code 'quantity_parse_error' if nothing can be extracted.
 */

const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, half: 0.5, quarter: 0.25,
  two: 2, three: 3, four: 4, five: 5,
};

const FRACTION_MAP = {
  '1/2': 0.5, '1/3': 1 / 3, '2/3': 2 / 3,
  '1/4': 0.25, '3/4': 0.75,
};

// Maps lowercase unit strings to canonical form
const UNIT_ALIASES = {
  g: 'g', gram: 'g', grams: 'g',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup',
  serving: 'serving', servings: 'serving',
};

function parseAmount(str) {
  // Try explicit fraction like "1/2"
  const fracMatch = str.match(/(\d+)\/(\d+)/);
  if (fracMatch) {
    return parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
  }
  // Try decimal / integer
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  return null;
}

function quantityParser(input) {
  if (!input || typeof input !== 'string') {
    throw { code: 'quantity_parse_error', message: 'Empty quantity string' };
  }

  const raw = input.trim().toLowerCase();

  // Strip parenthetical annotations like "(14g)" or "(177ml)"
  const cleaned = raw.replace(/\([^)]*\)/g, '').trim();

  let amount = null;
  let unit = null;

  // Check for known written fractions first (e.g. "1/2 cup" before general numeric)
  for (const [frac, val] of Object.entries(FRACTION_MAP)) {
    if (cleaned.includes(frac)) {
      amount = val;
      // Remove the fraction text and continue to find unit
      const rest = cleaned.replace(frac, '').trim();
      const words = rest.split(/\s+/);
      for (const w of words) {
        if (UNIT_ALIASES[w]) { unit = UNIT_ALIASES[w]; break; }
      }
      break;
    }
  }

  if (amount === null) {
    // Tokenise
    const tokens = cleaned.split(/[\s,]+/);
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (amount === null) {
        // Word number?
        if (WORD_NUMBERS[tok] !== undefined) {
          amount = WORD_NUMBERS[tok];
          continue;
        }
        // Numeric (possibly attached to a unit, e.g. "100g")
        const numMatch = tok.match(/^(\d+(?:\.\d+)?)(.*)$/);
        if (numMatch) {
          amount = parseFloat(numMatch[1]);
          const suffix = numMatch[2];
          if (suffix && UNIT_ALIASES[suffix]) {
            unit = UNIT_ALIASES[suffix];
          }
          continue;
        }
      }
      if (unit === null && UNIT_ALIASES[tok]) {
        unit = UNIT_ALIASES[tok];
      }
    }
  }

  if (amount === null) {
    throw { code: 'quantity_parse_error', message: `Could not extract a number from: "${input}"` };
  }

  if (amount <= 0) {
    throw { code: 'quantity_parse_error', message: 'Amount must be positive' };
  }

  // Build result
  if (unit === 'g') {
    return { amount, unit: 'g', type: 'weight', grams: amount };
  }
  if (unit === 'oz') {
    return { amount, unit: 'oz', type: 'weight', grams: amount * 28.3495 };
  }
  if (unit === 'tbsp') {
    return { amount, unit: 'tbsp', type: 'portion', portionUnit: 'tablespoon' };
  }
  if (unit === 'tsp') {
    return { amount, unit: 'tsp', type: 'portion', portionUnit: 'teaspoon' };
  }
  if (unit === 'cup') {
    return { amount, unit: 'cup', type: 'portion', portionUnit: 'cup' };
  }
  if (unit === 'serving') {
    return { amount, unit: 'serving', type: 'serving' };
  }

  // No recognised unit — treat as a serving count
  return { amount, unit: unit || '', type: 'serving' };
}

module.exports = quantityParser;
