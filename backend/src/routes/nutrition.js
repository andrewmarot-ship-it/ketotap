const express = require('express');
const https = require('https');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// In-memory cache: key → { data, expiresAt }
const cache = new Map();
const CACHE_TTL_V1_MS = 24 * 60 * 60 * 1000;       // 24 hours (v1 lookup)
const CACHE_TTL_V2_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days  (v2 portions)

// USDA FoodData Central nutrient IDs
const NID = { calories: 1008, fat: 1004, protein: 1003, carbs: 1005 };

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode === 429) {
            reject(new Error('USDA_RATE_LIMIT'));
          } else if (res.statusCode >= 400) {
            reject(new Error(`USDA_ERROR_${res.statusCode}`));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error('Invalid JSON from upstream'));
        }
      });
    }).on('error', reject);
  });
}

// Extract a nutrient value from a full food-detail foodNutrients array
function getNutrient(foodNutrients, nid) {
  const n = (foodNutrients || [])
    .find(fn => fn.nutrient?.id === nid || fn.nutrientId === nid);
  return n ? (n.amount ?? n.value ?? 0) : 0;
}

// ─── v2: GET /api/nutrition/portions ─────────────────────────────────────────
//
// Accepts:  ?food=avocado
// Returns:  per_100g values + sorted, deduplicated USDA portion list
// Cache:    7-day TTL keyed on normalised food name

router.get('/portions', async (req, res) => {
  const { food } = req.query;
  if (!food || !food.trim()) {
    return res.status(400).json({ error: 'food_not_found', message: 'food param is required' });
  }

  const cacheKey = `portions:${food.trim().toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return res.json(cached.data);
  }

  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';

  // Single search call — Foundation+SR Legacy first, fall back to Branded if empty.
  // The search response already includes foodPortions and foodNutrients for these
  // data types, so no second detail call is needed.
  let match = null;
  for (const dataType of ['Foundation,SR%20Legacy', 'Foundation,SR%20Legacy,Branded']) {
    const searchUrl =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food.trim())}` +
      `&pageSize=5&dataType=${dataType}&api_key=${apiKey}`;
    let searchResult;
    try {
      searchResult = await httpsGet(searchUrl);
    } catch {
      return res.status(502).json({ error: 'upstream_error', message: 'Failed to reach USDA FoodData Central' });
    }
    const foods = searchResult.foods || [];
    if (foods.length > 0) {
      match = foods[0];
      break;
    }
  }

  if (!match) {
    return res.status(404).json({ error: 'food_not_found', message: `No USDA entry found for "${food}"` });
  }

  // Per-100g macros (round to 1 decimal)
  const r1 = v => Math.round(v * 10) / 10;
  const per_100g = {
    calories:  r1(getNutrient(match.foodNutrients, NID.calories)),
    fat_g:     r1(getNutrient(match.foodNutrients, NID.fat)),
    carbs_g:   r1(getNutrient(match.foodNutrients, NID.carbs)),
    protein_g: r1(getNutrient(match.foodNutrients, NID.protein)),
  };

  // Build portions list from search result's foodPortions
  const rawPortions = (match.foodPortions || [])
    .map(p => ({
      label: (p.portionDescription || p.modifier || '').trim(),
      gram_weight: Math.round(p.gramWeight || 0),
    }))
    .filter(p => p.gram_weight > 0 && p.label);

  // Deduplicate by gram_weight (keep first per unique gram_weight)
  const seen = new Set();
  const deduped = rawPortions.filter(p => {
    if (seen.has(p.gram_weight)) return false;
    seen.add(p.gram_weight);
    return true;
  });

  // Sort descending by gram_weight, then prepend 100g option
  deduped.sort((a, b) => b.gram_weight - a.gram_weight);
  const portions = [{ label: '100g', gram_weight: 100 }, ...deduped].slice(0, 6);

  const data = {
    fdc_id: match.fdcId,
    food_name: match.description,
    source: 'USDA FoodData Central',
    per_100g,
    portions,
  };

  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_V2_MS });
  return res.json(data);
});

// ─── v1: GET /api/nutrition/lookup (deprecated — kept live) ──────────────────
const quantityParser = require('../utils/quantityParser');

function findPortionGrams(food, portionUnit) {
  const portions = food.foodPortions || [];
  const keywords = {
    tablespoon: ['tablespoon', 'tbsp'],
    teaspoon: ['teaspoon', 'tsp'],
    cup: ['cup'],
  };
  const keys = keywords[portionUnit] || [portionUnit];
  const match = portions.find(p => {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    return keys.some(k => desc.includes(k));
  });
  return match ? match.gramWeight : null;
}

function getNutrientV1(food, nid) {
  const n = (food.foodNutrients || []).find(fn => fn.nutrientId === nid || fn.nutrient?.id === nid);
  return n ? (n.value ?? n.amount ?? 0) : 0;
}

router.get('/lookup', async (req, res) => {
  const { food, quantity } = req.query;

  if (!food || !food.trim()) {
    return res.status(400).json({ error: 'food_not_found', message: 'food param is required' });
  }
  if (!quantity || !quantity.trim()) {
    return res.status(400).json({ error: 'quantity_parse_error', message: 'quantity param is required' });
  }

  let parsed;
  try {
    parsed = quantityParser(quantity);
  } catch (err) {
    return res.status(400).json({ error: err.code || 'quantity_parse_error', message: err.message });
  }

  const cacheKey = `${food.trim().toLowerCase()}:${quantity.trim().toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return res.json(cached.data);
  }

  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';
  const searchUrl =
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food.trim())}` +
    `&pageSize=5&dataType=Foundation,SR%20Legacy,Branded&api_key=${apiKey}`;

  let searchResult;
  try {
    searchResult = await httpsGet(searchUrl);
  } catch {
    return res.status(502).json({ error: 'upstream_error', message: 'Failed to reach USDA FoodData Central' });
  }

  const foods = searchResult.foods || [];
  if (foods.length === 0) {
    return res.status(404).json({ error: 'food_not_found', message: `No USDA entry found for "${food}"` });
  }

  const match = foods[0];
  let scaleFactor;
  if (parsed.type === 'weight') {
    scaleFactor = parsed.grams / 100;
  } else if (parsed.type === 'portion') {
    const portionGrams = findPortionGrams(match, parsed.portionUnit);
    scaleFactor = portionGrams != null ? (portionGrams * parsed.amount) / 100 : parsed.amount;
  } else {
    const portions = match.foodPortions || [];
    const defaultGrams = portions.length > 0 ? portions[0].gramWeight : 100;
    scaleFactor = (defaultGrams * parsed.amount) / 100;
  }

  const round1 = v => Math.round(v * 10) / 10;
  const data = {
    fdc_id: match.fdcId,
    food_name: match.description,
    quantity_label: quantity.trim(),
    calories:  round1(getNutrientV1(match, NID.calories)  * scaleFactor),
    fat_g:     round1(getNutrientV1(match, NID.fat)       * scaleFactor),
    protein_g: round1(getNutrientV1(match, NID.protein)   * scaleFactor),
    carbs_g:   round1(getNutrientV1(match, NID.carbs)     * scaleFactor),
  };

  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_V1_MS });
  return res.json(data);
});

module.exports = router;
