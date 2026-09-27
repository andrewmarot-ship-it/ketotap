export function guessEmoji(name) {
  if (!name) return '🍽️';
  const n = name.toLowerCase();
  const map = [
    [['olive oil', 'olive'],                                        '🫒'],
    [['coconut oil', 'coconut'],                                    '🥥'],
    [['butter', 'ghee'],                                            '🧈'],
    [['cream', 'milk'],                                             '🥛'],
    [['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia'], '🌰'],
    [['nut butter', 'almond butter', 'peanut butter', 'tahini'],   '🌰'],
    [['chia', 'hemp seed', 'flaxseed', 'flax seed', 'sunflower seed', 'pumpkin seed'], '🌱'],
    [['seed', 'seeds'],                                             '🌱'],
    [['chicken', 'turkey', 'duck', 'poultry'],                      '🍗'],
    [['shrimp', 'prawn', 'lobster', 'crab', 'scallop'],             '🍤'],
    [['salmon', 'tuna', 'fish', 'cod', 'halibut', 'sardine', 'mackerel', 'tilapia', 'trout'], '🐟'],
    [['beef', 'steak', 'ground beef', 'brisket', 'ribeye', 'lamb', 'venison'], '🥩'],
    [['bacon', 'pork', 'ham', 'sausage', 'pepperoni', 'salami', 'prosciutto'], '🥓'],
    [['egg'],                                                       '🥚'],
    [['cheese', 'feta', 'mozzarella', 'cheddar', 'brie', 'parmesan', 'gouda', 'marble'], '🧀'],
    [['yogurt', 'yoghurt'],                                         '🍶'],
    [['avocado'],                                                   '🥑'],
    [['broccoli'],                                                  '🥦'],
    [['pepper', 'capsicum', 'jalapeño', 'jalapeno', 'chili'],       '🫑'],
    [['zucchini', 'courgette', 'cucumber'],                         '🥒'],
    [['chocolate', 'cocoa', 'cacao'],                               '🍫'],
    [['coffee', 'espresso', 'latte', 'cappuccino'],                 '☕'],
    [['tea', 'matcha'],                                             '🍵'],
    [['water', 'sparkling water'],                                  '💧'],
    [['bread', 'toast', 'sourdough', 'bagel', 'pita'],              '🍞'],
    [['rice', 'quinoa', 'couscous'],                                '🫙'],
    [['oat', 'granola', 'cereal', 'muesli'],                        '🌾'],
    [['pasta', 'noodle', 'spaghetti', 'linguine', 'fettuccine'],    '🍝'],
    [['soup', 'broth', 'stock', 'bone broth'],                      '🍲'],
    [['salad', 'lettuce', 'spinach', 'kale', 'arugula', 'mixed greens'], '🥗'],
    [['tomato'],                                                    '🍅'],
    [['lemon', 'lime'],                                             '🍋'],
    [['orange', 'mandarin', 'tangerine', 'grapefruit'],             '🍊'],
    [['strawberry', 'blueberry', 'raspberry', 'blackberry', 'berry'], '🍓'],
    [['apple'],                                                     '🍎'],
    [['banana'],                                                    '🍌'],
    [['mushroom'],                                                  '🍄'],
    [['onion', 'shallot', 'leek', 'garlic'],                        '🧅'],
    [['protein powder', 'whey', 'protein shake', 'creatine', 'supplement'], '💪'],
    [['oil', 'vinegar', 'sauce', 'dressing', 'mayo', 'mustard', 'ketchup'], '🫙'],
  ];
  for (const [keywords, emoji] of map) {
    if (keywords.some(k => n.includes(k))) return emoji;
  }
  return '🍽️';
}
