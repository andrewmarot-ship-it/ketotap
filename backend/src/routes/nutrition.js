const express = require('express');
const https = require('https');
const { authMiddleware } = require('../middleware/auth');
const quantityParser = require('../utils/quantityParser');

const router = express.Router();
router.use(authMiddleware);

// In-memory cache: key → { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// USDA FoodData Central nutrient IDs
const NID = { calories: 1008, fat: 1004, protein: 1003, carbs: 1005 };

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON from upstream')); }
      });
    }).on('error', reject);
  });
}

function getNutrient(food, nid) {
  const n = (food.foodNutrients || []).find(fn => fn.nutrientId === nid || fn.nutrient?.id === nid);
  return n ? (n.value ?? n.amount ?? 0) : 0;
}

function findPortionGrams(food, portionUnit) {
  const portions = food.foodPortions || [];
  // Try to match by portionDescription containing the unit keyword
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

router.get('/lookup', async (req, res) => {
  const { food, quantity } = req.query;

  if (!food || !food.trim()) {
    return res.status(400).json({ error: 'food_not_found', message: 'food param is required' });
  }
  if (!quantity || !quantity.trim()) {
    return res.status(400).json({ error: 'quantity_parse_error', message: 'quantity param is required' });
  }

  // Parse quantity first (fail fast before hitting USDA)
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
  const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food.trim())}&pageSize=5&dataType=Foundation,SR%20Legacy,Branded&api_key=${apiKey}`;

  let searchResult;
  try {
    searchResult = await httpsGet(searchUrl);
  } catch (err) {
    return res.status(502).json({ error: 'upstream_error', message: 'Failed to reach USDA FoodData Central' });
  }

  const foods = searchResult.foods || [];
  if (foods.length === 0) {
    return res.status(404).json({ error: 'food_not_found', message: `No USDA entry found for "${food}"` });
  }

  const match = foods[0];

  // Determine scale factor (all USDA values are per 100g)
  let scaleFactor;
  if (parsed.type === 'weight') {
    scaleFactor = parsed.grams / 100;
  } else if (parsed.type === 'portion') {
    const portionGrams = findPortionGrams(match, parsed.portionUnit);
    scaleFactor = portionGrams != null ? (portionGrams * parsed.amount) / 100 : parsed.amount;
  } else {
    // serving
    const portions = match.foodPortions || [];
    const defaultGrams = portions.length > 0 ? portions[0].gramWeight : 100;
    scaleFactor = (defaultGrams * parsed.amount) / 100;
  }

  const round1 = v => Math.round(v * 10) / 10;

  const data = {
    fdc_id: match.fdcId,
    food_name: match.description,
    quantity_label: quantity.trim(),
    calories: round1(getNutrient(match, NID.calories) * scaleFactor),
    fat_g: round1(getNutrient(match, NID.fat) * scaleFactor),
    protein_g: round1(getNutrient(match, NID.protein) * scaleFactor),
    carbs_g: round1(getNutrient(match, NID.carbs) * scaleFactor),
  };

  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });

  return res.json(data);
});

module.exports = router;
