const express = require('express');
const https = require('https');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// In-memory cache: key → { data, expiresAt }
const cache = new Map();
const CACHE_TTL_V1_MS = 24 * 60 * 60 * 1000;       // 24 hours (v1 lookup)
const CACHE_TTL_V2_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days  (v2 portions)

// Purge entries once per hour. Entries survive for 2×TTL so stale data is
// available as a fallback when USDA is rate-limiting.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if ((v.purgeAt ?? v.expiresAt) <= now) cache.delete(k);
  }
}, 60 * 60 * 1000).unref();

// USDA FoodData Central nutrient IDs
const NID = { calories: 1008, fat: 1004, protein: 1003, carbs: 1005, fiber: 1079 };

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
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
        } catch {
          reject(new Error('Invalid JSON from upstream'));
        }
      });
    }).on('error', reject);
  });
}

// Extract a nutrient value from a food-detail foodNutrients array
function getNutrient(foodNutrients, nid) {
  const n = (foodNutrients || [])
    .find(fn => fn.nutrient?.id === nid || fn.nutrientId === nid);
  return n ? (n.amount ?? n.value ?? 0) : 0;
}

function upstreamErr(res, err) {
  console.error('[nutrition] USDA error:', err.message);
  const isRateLimit = err.message === 'USDA_RATE_LIMIT';
  return res.status(502).json({
    error: 'upstream_error',
    message: isRateLimit
      ? 'USDA rate limit reached. Try again later or set USDA_FDC_API_KEY.'
      : 'Failed to reach USDA FoodData Central',
  });
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

  const foodQ = food.trim();
  const cacheKey = `portions:${foodQ.toLowerCase()}`;
  const now = Date.now();
  const entry = cache.get(cacheKey);   // kept in scope as stale fallback
  if (entry && entry.expiresAt > now) return res.json(entry.data);

  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';

  // Step 1: search Foundation+SR Legacy first; fall back to Branded if empty or errored.
  let fdcId = null;
  let lastSearchErr = null;
  for (const dataType of ['Foundation,SR%20Legacy', 'Foundation,SR%20Legacy,Branded']) {
    const searchUrl =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodQ)}` +
      `&pageSize=5&dataType=${dataType}&api_key=${apiKey}`;
    try {
      const result = await httpsGet(searchUrl);
      const foods = result.foods || [];
      if (foods.length > 0) {
        fdcId = foods[0].fdcId;
        break;
      }
    } catch (err) {
      console.error('[nutrition] USDA search error:', err.message);
      lastSearchErr = err;
    }
  }

  if (!fdcId) {
    if (lastSearchErr?.message === 'USDA_RATE_LIMIT' && entry) {
      console.warn('[nutrition] Rate limited; serving stale cache for', cacheKey);
      return res.json({ ...entry.data, stale: true });
    }
    if (lastSearchErr) return upstreamErr(res, lastSearchErr);
    return res.status(404).json({ error: 'food_not_found', message: `No USDA entry found for "${foodQ}"` });
  }

  // Step 2: fetch full food detail — only this response contains foodPortions
  let detail;
  try {
    detail = await httpsGet(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
  } catch (err) {
    if (err.message === 'USDA_RATE_LIMIT' && entry) {
      console.warn('[nutrition] Rate limited; serving stale cache for', cacheKey);
      return res.json({ ...entry.data, stale: true });
    }
    return upstreamErr(res, err);
  }

  // Per-100g macros (round to 1 decimal)
  const r1 = v => Math.round(v * 10) / 10;
  const per_100g = {
    calories:  r1(getNutrient(detail.foodNutrients, NID.calories)),
    fat_g:     r1(getNutrient(detail.foodNutrients, NID.fat)),
    carbs_g:   r1(getNutrient(detail.foodNutrients, NID.carbs)),
    protein_g: r1(getNutrient(detail.foodNutrients, NID.protein)),
    fiber_g:   r1(getNutrient(detail.foodNutrients, NID.fiber)),
  };

  // Build portions list
  const rawPortions = (detail.foodPortions || [])
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
    fdc_id: detail.fdcId,
    food_name: detail.description,
    source: 'USDA FoodData Central',
    per_100g,
    portions,
  };

  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_V2_MS, purgeAt: now + 2 * CACHE_TTL_V2_MS });
  return res.json(data);
});

// ─── GET /api/nutrition/barcode/:code ────────────────────────────────────────
//
// Looks a packaged food up by barcode: Open Food Facts first, then USDA branded foods.
// Returns macros for one serving. total_carbs_g always INCLUDES fiber, so the client can
// compute net carbs as total_carbs_g - fiber_g regardless of the label's country.

const CACHE_TTL_BARCODE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_BARCODE_MISS_MS = 24 * 60 * 60 * 1000;
const OFF_HEADERS = { 'User-Agent': 'KetoTap/1.0 (keto macro tracker beta)' };
// North American labels count fiber inside total carbohydrate; EU/UK/AU labels list it separately
const FIBER_IN_CARBS_COUNTRIES = ['en:united-states', 'en:canada', 'en:mexico'];

const r1 = v => Math.round(v * 10) / 10;

// UPC-E (8 digits, number system 0/1) is a compressed UPC-A used on small packages.
// Databases store the full 12-digit form, so expand it. Returns null if not UPC-E shaped.
function expandUpcE(code) {
  if (code.length !== 8 || !/^[01]/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body;
  if ('012'.includes(last)) body = d[0] + d[1] + last + '0000' + d[2] + d[3] + d[4];
  else if (last === '3') body = d[0] + d[1] + d[2] + '00000' + d[3] + d[4];
  else if (last === '4') body = d[0] + d[1] + d[2] + d[3] + '00000' + d[4];
  else body = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + last;
  return ns + body + check;
}

function barcodeVariants(code) {
  const variants = [code];
  const upcA = expandUpcE(code);
  if (upcA) variants.push(upcA, '0' + upcA);
  if (code.length === 12) variants.push('0' + code);
  if (code.length === 13 && code.startsWith('0')) variants.push(code.slice(1));
  return variants;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Returns { ...product, incomplete } where any of calories/fat/protein/carbs may be null when
// Open Food Facts knows the product but not all of its nutrition. Returns null if unknown.
async function lookupOpenFoodFacts(code) {
  const fields = 'code,product_name,brands,serving_size,serving_quantity,nutriments,countries_tags';
  let partial = null;
  for (const variant of barcodeVariants(code)) {
    let body;
    try {
      body = await httpsGet(`https://world.openfoodfacts.org/api/v2/product/${variant}?fields=${fields}`, OFF_HEADERS);
    } catch (err) {
      if (err.message === 'USDA_ERROR_404') continue; // httpsGet's generic 4xx naming
      throw err;
    }
    if (body.status !== 1 || !body.product) continue;

    const p = body.product;
    const n = p.nutriments || {};
    const grams = num(p.serving_quantity);
    const per100 = key => num(n[`${key}_100g`]);
    const perServing = key => num(n[`${key}_serving`]);
    const CORE = ['energy-kcal', 'energy', 'fat', 'proteins', 'carbohydrates'];
    const hasAny = getter => CORE.some(k => getter(k) !== null);

    // Pick one basis for all values: per 100 g scaled to the serving, per serving, or per 100 g
    let pick, serving;
    if (grams && hasAny(per100)) {
      pick = key => (per100(key) === null ? null : per100(key) * grams / 100);
      serving = p.serving_size || `${grams} g`;
    } else if (hasAny(perServing)) {
      pick = perServing;
      serving = p.serving_size || '1 serving';
    } else if (hasAny(per100)) {
      pick = per100;
      serving = '100 g';
    } else {
      pick = () => null;
      serving = p.serving_size || '';
    }

    let kcal = pick('energy-kcal');
    if (kcal === null && pick('energy') !== null) kcal = pick('energy') / 4.184; // some entries only have kJ
    const fat = pick('fat');
    const protein = pick('proteins');
    const carbs = pick('carbohydrates');
    const fiber = pick('fiber');
    const tags = p.countries_tags || [];
    const fiberIncluded = tags.length === 0 || tags.some(t => FIBER_IN_CARBS_COUNTRIES.includes(t));
    const totalCarbs = carbs === null ? null : (fiberIncluded || fiber === null ? carbs : carbs + fiber);

    const product = {
      source: 'Open Food Facts',
      name: (p.product_name || p.brands || '').trim(),
      brand: (p.brands || '').split(',')[0].trim() || null,
      serving_description: serving,
      calories: kcal === null ? null : Math.round(kcal),
      fat_g: fat === null ? null : r1(fat),
      protein_g: protein === null ? null : r1(protein),
      total_carbs_g: totalCarbs === null ? null : r1(totalCarbs),
      fiber_g: fiber === null ? null : r1(fiber),
    };
    product.incomplete = [product.calories, product.fat_g, product.protein_g, product.total_carbs_g].some(v => v === null);
    if (!product.incomplete) return product;
    // Keep the most useful partial match and keep looking for a complete one
    if (!partial || (product.name && !partial.name)) partial = product;
  }
  return partial;
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
}

async function lookupUsdaBranded(code) {
  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';
  const upc = expandUpcE(code) || code; // USDA stores full UPC-A
  const result = await httpsGet(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${upc}&dataType=Branded&pageSize=10&api_key=${apiKey}`
  );
  const strip = s => String(s || '').replace(/^0+/, '');
  const match = (result.foods || []).find(f => strip(f.gtinUpc) === strip(upc));
  if (!match) return null;

  // Branded search results report nutrients per 100 g/ml
  const unit = String(match.servingSizeUnit || '').toLowerCase();
  const size = num(match.servingSize);
  const byWeight = size && ['g', 'grm', 'ml', 'mlt'].includes(unit);
  const factor = byWeight ? size / 100 : 1;
  const get = nid => (match.foodNutrients || []).find(fn => fn.nutrientId === nid)?.value ?? 0;
  const serving = byWeight
    ? (match.householdServingFullText ? `${match.householdServingFullText} (${size} ${unit.startsWith('m') ? 'ml' : 'g'})` : `${size} ${unit.startsWith('m') ? 'ml' : 'g'}`)
    : '100 g';

  return {
    source: 'USDA FoodData Central',
    name: titleCase(match.description || ''),
    brand: match.brandName || match.brandOwner || null,
    serving_description: serving,
    calories: Math.round(get(NID.calories) * factor),
    fat_g: r1(get(NID.fat) * factor),
    protein_g: r1(get(NID.protein) * factor),
    total_carbs_g: r1(get(NID.carbs) * factor),
    fiber_g: r1(get(NID.fiber) * factor),
  };
}

router.get('/barcode/:code', async (req, res) => {
  const code = String(req.params.code).replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(code)) {
    return res.status(400).json({ error: 'invalid_barcode', message: 'Barcode must be 8 to 14 digits' });
  }

  const cacheKey = `barcode:${code}`;
  const now = Date.now();
  const entry = cache.get(cacheKey);
  if (entry && entry.expiresAt > now) {
    return entry.data ? res.json(entry.data) : res.status(404).json({ error: 'not_found', barcode: code });
  }

  let product = null;
  let partial = null;
  let lastErr = null;
  for (const lookup of [lookupOpenFoodFacts, lookupUsdaBranded]) {
    try {
      const found = await lookup(code);
      if (found && !found.incomplete) { product = found; break; }
      if (found && !partial) partial = found;
    } catch (err) {
      console.error(`[nutrition] barcode ${lookup.name} error:`, err.message);
      lastErr = err;
    }
  }
  if (!product && partial) {
    // Known product, missing nutrition: return what we have. Short cache so later data is picked up.
    const data = { barcode: code, ...partial };
    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_BARCODE_MISS_MS, purgeAt: now + CACHE_TTL_BARCODE_MISS_MS });
    return res.json(data);
  }

  if (product) {
    const data = { barcode: code, ...product, incomplete: false };
    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_BARCODE_MS, purgeAt: now + 2 * CACHE_TTL_BARCODE_MS });
    return res.json(data);
  }
  if (lastErr) {
    if (entry?.data) return res.json({ ...entry.data, stale: true });
    return res.status(502).json({ error: 'upstream_error', message: 'Could not reach the food databases. Try again, or enter it manually.' });
  }
  cache.set(cacheKey, { data: null, expiresAt: now + CACHE_TTL_BARCODE_MISS_MS, purgeAt: now + CACHE_TTL_BARCODE_MISS_MS });
  return res.status(404).json({ error: 'not_found', barcode: code });
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
  const entry = cache.get(cacheKey);   // kept in scope as stale fallback
  if (entry && entry.expiresAt > now) return res.json(entry.data);

  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';
  const searchUrl =
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food.trim())}` +
    `&pageSize=5&dataType=Foundation,SR%20Legacy,Branded&api_key=${apiKey}`;

  let searchResult;
  try {
    searchResult = await httpsGet(searchUrl);
  } catch (err) {
    if (err.message === 'USDA_RATE_LIMIT' && entry) {
      console.warn('[nutrition] Rate limited; serving stale cache for', cacheKey);
      return res.json({ ...entry.data, stale: true });
    }
    return upstreamErr(res, err);
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

  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_V1_MS, purgeAt: now + 2 * CACHE_TTL_V1_MS });
  return res.json(data);
});

module.exports = router;
module.exports.expandUpcE = expandUpcE;
module.exports.barcodeVariants = barcodeVariants;
