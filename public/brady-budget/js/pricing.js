export const SHOPPING_STORES = [
  { id: "aldi", label: "ALDI", fallback: 5 },
  { id: "coles", label: "Coles", fallback: 5.5 },
  { id: "woolworths", label: "Woolworths", fallback: 5.5 },
  { id: "other", label: "Other", fallback: 5.5 },
];

const PRICE_GUIDE = [
  ["milk", ["milk", "full cream milk", "lite milk", "2l milk"], 3.55, 3.55, 3.55],
  ["bread", ["bread", "white bread", "wholemeal bread", "sandwich bread"], 2.79, 2.90, 2.90],
  ["eggs", ["eggs", "dozen eggs", "12 eggs"], 5.49, 5.90, 5.90],
  ["butter", ["butter", "salted butter", "unsalted butter"], 5.49, 6.00, 6.00],
  ["cheese", ["cheese", "tasty cheese", "cheddar cheese", "cheese block"], 6.99, 7.50, 7.50],
  ["yoghurt", ["yoghurt", "yogurt", "greek yoghurt", "greek yogurt"], 4.49, 4.80, 4.80],
  ["bananas", ["banana", "bananas"], 4.00, 4.50, 4.50],
  ["apples", ["apple", "apples", "pink lady apples"], 4.99, 5.50, 5.50],
  ["oranges", ["orange", "oranges"], 4.99, 5.50, 5.50],
  ["lemons", ["lemon", "lemons"], 1.29, 1.40, 1.40],
  ["strawberries", ["strawberry", "strawberries", "strawberries 250g"], 4.69, 5.00, 5.00],
  ["grapes", ["grape", "grapes", "seedless grapes"], 8.99, 9.50, 9.50],
  ["potatoes", ["potato", "potatoes", "washed potatoes"], 4.49, 5.00, 5.00],
  ["onions", ["onion", "onions", "brown onions"], 3.49, 4.00, 4.00],
  ["carrots", ["carrot", "carrots"], 2.49, 2.80, 2.80],
  ["tomatoes", ["tomato", "tomatoes", "fresh tomatoes"], 5.99, 6.50, 6.50],
  ["broccoli", ["broccoli"], 3.49, 4.00, 4.00],
  ["lettuce", ["lettuce", "iceberg lettuce"], 3.49, 4.00, 4.00],
  ["avocado", ["avocado", "avocados"], 1.49, 1.80, 1.80],
  ["chicken-breast", ["chicken breast", "chicken breasts"], 11.99, 13.00, 13.00],
  ["chicken-thighs", ["chicken thigh", "chicken thighs"], 9.99, 11.00, 11.00],
  ["beef-mince", ["beef mince", "minced beef", "mince"], 6.49, 7.00, 7.00],
  ["sausages", ["sausage", "sausages"], 6.99, 7.50, 7.50],
  ["bacon", ["bacon"], 5.99, 6.50, 6.50],
  ["salmon", ["salmon", "salmon fillets"], 11.99, 13.00, 13.00],
  ["tuna", ["tuna", "canned tuna", "tin tuna"], 1.29, 1.50, 1.50],
  ["pasta", ["pasta", "spaghetti", "penne", "fusilli"], 0.99, 1.20, 1.20],
  ["rice", ["rice", "jasmine rice", "white rice", "long grain rice"], 2.99, 3.30, 3.30],
  ["flour", ["flour", "plain flour", "self raising flour"], 1.79, 2.00, 2.00],
  ["sugar", ["sugar", "white sugar", "raw sugar"], 2.49, 2.80, 2.80],
  ["canned-tomatoes", ["canned tomatoes", "tinned tomatoes", "diced tomatoes"], 0.95, 1.10, 1.10],
  ["baked-beans", ["baked beans", "beans tin"], 1.09, 1.30, 1.30],
  ["cereal", ["cereal", "breakfast cereal", "corn flakes"], 3.99, 4.50, 4.50],
  ["oats", ["oats", "rolled oats", "porridge"], 1.79, 2.00, 2.00],
  ["olive-oil", ["olive oil", "extra virgin olive oil"], 7.99, 9.00, 9.00],
  ["cooking-oil", ["cooking oil", "sunflower oil", "vegetable oil"], 4.99, 5.50, 5.50],
  ["coffee", ["coffee", "instant coffee", "coffee beans", "ground coffee"], 8.99, 10.00, 10.00],
  ["tea", ["tea", "tea bags", "black tea"], 2.99, 3.50, 3.50],
  ["peanut-butter", ["peanut butter"], 3.49, 3.80, 3.80],
  ["jam", ["jam", "strawberry jam"], 2.49, 2.80, 2.80],
  ["frozen-peas", ["frozen peas", "peas frozen"], 2.69, 3.00, 3.00],
  ["frozen-chips", ["frozen chips", "oven chips", "hot chips frozen"], 3.49, 4.00, 4.00],
  ["biscuits", ["biscuits", "cookies"], 2.49, 3.00, 3.00],
  ["crackers", ["crackers", "water crackers", "rice crackers"], 2.49, 3.00, 3.00],
  ["toilet-paper", ["toilet paper", "toilet rolls"], 8.99, 10.00, 10.00],
  ["paper-towel", ["paper towel", "paper towels"], 4.49, 5.00, 5.00],
  ["dishwashing-liquid", ["dishwashing liquid", "dish soap", "washing up liquid"], 2.49, 3.00, 3.00],
  ["laundry", ["laundry liquid", "laundry powder", "washing powder", "washing liquid"], 7.99, 9.00, 9.00],
  ["bin-bags", ["bin bags", "garbage bags", "kitchen tidy bags"], 2.39, 3.00, 3.00],
];

const PRODUCT_LABELS = {
  milk: "Milk 2L",
  bread: "Bread loaf",
  eggs: "Eggs 12 pack",
  butter: "Butter 500g",
  cheese: "Tasty cheese block",
  yoghurt: "Greek yoghurt tub",
  apples: "Apples 1kg",
  oranges: "Oranges 1kg",
  strawberries: "Strawberries 250g",
  grapes: "Seedless grapes 900g",
  potatoes: "Potatoes 2kg",
  onions: "Brown onions 1kg",
  carrots: "Carrots 1kg",
  "chicken-breast": "Chicken breast 1kg",
  "chicken-thighs": "Chicken thighs 1kg",
  "beef-mince": "Beef mince 500g",
  salmon: "Salmon fillets 2 pack",
  tuna: "Canned tuna",
  pasta: "Pasta 500g",
  rice: "Jasmine rice 1kg",
  flour: "Plain flour 1kg",
  sugar: "White sugar 1kg",
  "canned-tomatoes": "Diced tomatoes 400g",
  "baked-beans": "Baked beans 420g",
  oats: "Rolled oats 1kg",
  "olive-oil": "Extra virgin olive oil 500ml",
  "cooking-oil": "Cooking oil 1L",
  "toilet-paper": "Toilet paper pack",
  "paper-towel": "Paper towel pack",
  "dishwashing-liquid": "Dishwashing liquid",
  laundry: "Laundry detergent",
  "bin-bags": "Kitchen tidy bags",
};

export function normaliseStoreId(storeId) {
  return SHOPPING_STORES.some((store) => store.id === storeId) ? storeId : "aldi";
}

export function storeLabel(storeId) {
  return SHOPPING_STORES.find((store) => store.id === normaliseStoreId(storeId))?.label || "ALDI";
}

export function normaliseShoppingItemName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function guideLabel(id, aliases) {
  return PRODUCT_LABELS[id] || titleCase(aliases[0]);
}

function editDistance(first, second) {
  const rows = Array.from({ length: first.length + 1 }, (_, index) => index);
  for (let column = 1; column <= second.length; column += 1) {
    let diagonal = rows[0];
    rows[0] = column;
    for (let row = 1; row <= first.length; row += 1) {
      const previous = rows[row];
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        diagonal + (first[row - 1] === second[column - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return rows[first.length];
}

function matchScore(query, candidate) {
  if (query === candidate) return 10_000 + candidate.length;
  if (query.includes(candidate)) return 1_000 + candidate.length;
  if (candidate.startsWith(query) && query.length >= 2) return 600 + query.length;
  if (candidate.includes(query) && query.length >= 3) return 400 + query.length;
  if (query.length >= 4 && candidate.length >= 4) {
    const allowedDistance = Math.min(2, Math.max(1, Math.floor(Math.min(query.length, candidate.length) / 5)));
    const distance = editDistance(query, candidate);
    if (distance <= allowedDistance) return 200 - distance;
  }
  return 0;
}

function matchGuide(query) {
  let best = null;
  for (const [id, aliases, aldi, coles, woolworths] of PRICE_GUIDE) {
    for (const alias of aliases) {
      const candidate = normaliseShoppingItemName(alias);
      const score = matchScore(query, candidate);
      if (score > (best?.score || 0)) best = { id, label: guideLabel(id, aliases), prices: { aldi, coles, woolworths }, score };
    }
  }
  return best;
}

function priceForStore(prices, storeId) {
  if (Number.isFinite(prices[storeId])) return prices[storeId];
  const values = [prices.aldi, prices.coles, prices.woolworths];
  return Math.round((values.reduce((sum, price) => sum + price, 0) / values.length) * 100) / 100;
}

export function estimateShoppingPrice(name, storeId = "aldi", priceMemory = {}) {
  const query = normaliseShoppingItemName(name);
  if (query.length < 2) return null;
  const store = normaliseStoreId(storeId);
  const remembered = priceMemory?.[store]?.[query];
  if (Number.isFinite(Number(remembered?.price)) && Number(remembered.price) >= 0) {
    return { price: Number(remembered.price), source: "memory", key: query, description: "Your household's saved price" };
  }
  const guide = matchGuide(query);
  if (guide) return { price: priceForStore(guide.prices, store), source: "guide", key: guide.id, product: guide.label, description: `${storeLabel(store)} guide estimate for ${guide.label}` };
  const fallback = SHOPPING_STORES.find((entry) => entry.id === store)?.fallback || 5;
  return { price: fallback, source: "fallback", key: query, description: `${storeLabel(store)} general estimate` };
}

export function suggestShoppingProducts(name, storeId = "aldi", priceMemory = {}, limit = 4) {
  const query = normaliseShoppingItemName(name);
  if (query.length < 2) return [];
  const store = normaliseStoreId(storeId);
  const remembered = Object.entries(priceMemory?.[store] || {}).flatMap(([key, entry]) => {
    const score = matchScore(query, key);
    return score ? [{ key: `memory:${key}`, name: titleCase(key), price: Number(entry.price), source: "memory", score: score + 20_000 }] : [];
  });
  const guide = PRICE_GUIDE.flatMap(([id, aliases, aldi, coles, woolworths]) => {
    const score = Math.max(...aliases.map((alias) => matchScore(query, normaliseShoppingItemName(alias))));
    return score ? [{ key: id, name: guideLabel(id, aliases), price: priceForStore({ aldi, coles, woolworths }, store), source: "guide", score }] : [];
  });
  return [...remembered, ...guide]
    .sort((first, second) => second.score - first.score)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.name === item.name) === index)
    .slice(0, limit)
    .map((item) => ({ key: item.key, name: item.name, price: item.price, source: item.source }));
}

export function rememberShoppingPrice(priceMemory = {}, storeId, name, price, updatedAt = new Date().toISOString()) {
  const store = normaliseStoreId(storeId);
  const key = normaliseShoppingItemName(name);
  if (!key || !Number.isFinite(Number(price)) || Number(price) < 0) return priceMemory;
  return {
    ...priceMemory,
    [store]: {
      ...(priceMemory[store] || {}),
      [key]: { price: Number(price), updatedAt },
    },
  };
}
