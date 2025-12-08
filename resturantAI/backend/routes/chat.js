import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import { normalizeMessage } from './utils/normalize.js';

const router = express.Router();

// load knowledge base (structured json)
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));
const { restaurant, menu_items, faq, price_info } = kb;

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// model name for ollama
const modelName = process.env.OLLAMA_MODEL || 'mistral:instruct';

// helper: check if message is about the restaurant or menu
function isRestaurantQuestion(text) {
  const lower = text.toLowerCase();

  const restaurantKeywords = [
    'restaurant',
    'menu',
    'dish',
    'dishes',
    'food',
    'serve',
    'serv',
    'momo',
    'momoz',
    'chow mein',
    'fried rice',
    'dal bhat',
    'himalayan curry',
    'thukpa',
    'samosa',
    'masala fries',
    'price',
    'cost',
    'how much',
    'hours',
    'open',
    'close',
    'reservation',
    'catering',
    'delivery',
    'pickup',
    'order online',
    'address',
    'where are you',
    'where is this',
    'location',
    'zip',
    'halal',
    'vegan',
    'vegetarian',
    'gluten',
    'dairy',
    'nut',
    'allergy',
    'chef',
    'chefs',
    'owner',
    'staff',
    'tables',
    'seating',
    'founded'
  ];

  return restaurantKeywords.some((kw) => lower.includes(kw));
}

// helper: find a menu item by name or alias
function findMenuItem(text) {
  const lower = text.toLowerCase();
  const items = menu_items || {};

  for (const key of Object.keys(items)) {
    const item = items[key];
    const names = [item.name, ...(item.aliases || [])]
      .map((n) => n.toLowerCase());

    if (names.some((n) => lower.includes(n))) {
      return item;
    }
  }

  return null;
}

// helper: format a detailed menu item summary
function formatMenuItemSummary(item) {
  let answer = `${item.name}: ${item.description}`;

  if (item.ingredients && item.ingredients.length > 0) {
    answer += ` ingredients include ${item.ingredients.join(', ')}.`;
  }

  if (typeof item.base_price === 'number') {
    answer += ` price: $${item.base_price}.`;
  }

  return answer;
}

// helper: compute cheapest and most expensive dish
function getPriceExtremes() {
  const items = Object.values(menu_items || {}).filter(
    (item) => typeof item.base_price === 'number'
  );

  if (items.length === 0) return null;

  let cheapest = items[0];
  let priciest = items[0];

  for (const item of items) {
    if (item.base_price < cheapest.base_price) cheapest = item;
    if (item.base_price > priciest.base_price) priciest = item;
  }

  return { cheapest, priciest };
}

// main kb routing function
function getKbAnswer(message) {
  const lower = message.toLowerCase();

  // address / location / zip
  if (
    lower.includes('where is this restaurant') ||
    lower.includes('where is this resturant') ||
    lower.includes('where are you') ||
    lower.includes('where is the restaurant') ||
    lower.includes('what is your address') ||
    lower.includes('address') ||
    lower.includes('adrres') ||
    lower.includes('adres') ||
    lower.includes('what street') ||
    lower.includes('street are you on') ||
    lower.includes('wher is the resturant') ||
    lower.includes('wher is the restaurant')
  ) {
    return restaurant.address;
  }

  if (lower.includes('zip') || lower.includes('zipcode') || lower.includes('postal code')) {
    return restaurant.zip;
  }

  if (lower.includes('brooklyn')) {
    return `${restaurant.address}`;
  }

  // hours / open / close
  if (
    lower.includes('open right now') ||
    lower.includes('what time do you open') ||
    lower.includes('what time do you close') ||
    lower.includes('what time are you open') ||
    lower.includes('hours') ||
    lower.includes('open on weekends') ||
    lower.includes('when are you open') ||
    lower.includes('closing time') ||
    lower.includes('opening time')
  ) {
    return restaurant.hours.summary;
  }

  // menu overview and synonyms / typos
  if (
    lower.includes('what food do you sell') ||
    lower.includes('what food do you have') ||
    lower.includes('wut food u hav') ||
    lower.includes('wut food you have') ||
    lower.includes('what do you sell') ||
    lower.includes('what do u sell') ||
    lower.includes('what do you serv') ||
    lower.includes('wat do u serv') ||
    lower.includes('wut do u serve') ||
    lower.includes('what is on your menu') ||
    lower.includes('whats on your menu') ||
    lower.includes('what dishes do you have') ||
    lower.includes('do u sel momoz') ||
    lower.includes('menu')
  ) {
    return faq.menu_overview;
  }

  // most popular / recommendations
  if (
    lower.includes('most popular') ||
    lower.includes('popular items') ||
    lower.includes('what do you recommend') ||
    lower.includes('what would you recommend') ||
    lower.includes('what do u recommend') ||
    (lower.includes('recommend') && lower.includes('dish'))
  ) {
    return faq.popular_items;
  }

  // desserts
  if (lower.includes('dessert') || lower.includes('desert')) {
    return faq.desserts;
  }

  // fun fact
  if (lower.includes('fun fact')) {
    return restaurant.fun_fact;
  }

  // halal / vegan / gluten / dairy / nuts
  if (lower.includes('halal')) {
    return restaurant.dietary.halal_status;
  }

  if (lower.includes('vegan')) {
    return faq.vegan_options;
  }

  if (lower.includes('vegetarian')) {
    return faq.vegetarian_options;
  }

  if (lower.includes('gluten')) {
    return faq.gluten_info;
  }

  if (lower.includes('dairy')) {
    return faq.dairy_info;
  }

  if (lower.includes('nut') || lower.includes('allergy')) {
    return faq.nut_allergy_info;
  }

  // reservations / refund / delivery / catering / cancellation
  if (
    lower.includes('reservation') ||
    lower.includes('reservations') ||
    lower.includes('book a table')
  ) {
    return restaurant.policies.reservations;
  }

  if (
    lower.includes('refund policy') ||
    lower.includes('refund') ||
    lower.includes('return policy')
  ) {
    return restaurant.policies.refunds;
  }

  if (
    lower.includes('deliver') ||
    lower.includes('delivery') ||
    lower.includes('do you deliver') ||
    lower.includes('can i order online') ||
    lower.includes('order online')
  ) {
    return restaurant.policies.delivery;
  }

  if (
    lower.includes('catering') ||
    lower.includes('cater')
  ) {
    return restaurant.policies.catering;
  }

  if (
    lower.includes('cancellation fee') ||
    lower.includes('cancel reservation') ||
    lower.includes('cancellation policy')
  ) {
    return restaurant.policies.cancellation;
  }

  // staff / chefs / owner / seating / founded
  if (
    lower.includes('who cooks') ||
    lower.includes('who makes the food') ||
    lower.includes('chef') ||
    lower.includes('chefs')
  ) {
    return restaurant.chefs_summary;
  }

  if (
    lower.includes('how many tables') ||
    lower.includes('how big is your restaurant') ||
    lower.includes('how many seats') ||
    lower.includes('seating')
  ) {
    return restaurant.seating_summary;
  }

  if (
    lower.includes('when were you founded') ||
    lower.includes('when was the restaurant founded') ||
    lower.includes('when did you open') ||
    lower.includes('how long have you been open')
  ) {
    return `the himalayan house opened in ${restaurant.founded_year}.`;
  }

  if (lower.includes('who owns') || lower.includes('owner')) {
    return restaurant.owner_info;
  }

  // prices and drinks
  if (
    lower.includes('how much are the drinks') ||
    lower.includes('drink prices') ||
    (lower.includes('drinks') && lower.includes('price'))
  ) {
    return price_info.drinks_price_range;
  }

  if (lower.includes('cheapest')) {
    const extremes = getPriceExtremes();
    if (!extremes) return null;

    const { cheapest } = extremes;
    return `among our main dishes, the cheapest is ${cheapest.name} at $${cheapest.base_price}.`;
  }

  if (lower.includes('most expensive')) {
    const extremes = getPriceExtremes();
    if (!extremes) return null;

    const { priciest } = extremes;
    return `among our main dishes, the most expensive is ${priciest.name} at $${priciest.base_price}.`;
  }

  // per-dish logic: price / spicy / gluten / vegan / description
  const item = findMenuItem(lower);

  if (item) {
    // price for this dish
    if (
      lower.includes('how much') ||
      lower.includes('price') ||
      lower.includes('cost')
    ) {
      if (typeof item.base_price === 'number') {
        return `${item.name}: $${item.base_price}.`;
      }
    }

    // spicy / spice level
    if (lower.includes('spicy') || lower.includes('spice')) {
      if (item.spice_level === 'mild') {
        return `${item.name} is mildly spiced, but we can usually adjust the heat level on request.`;
      } else if (item.spice_level === 'medium') {
        return `${item.name} has a medium level of heat. please let us know if you prefer it milder.`;
      } else if (item.spice_level === 'hot') {
        return `${item.name} is one of our spicier dishes.`;
      }
    }

    // gluten
    if (lower.includes('gluten')) {
      if (item.contains_gluten) {
        return `${item.name} is not gluten free because it contains wheat-based ingredients. our kitchen also handles wheat, so cross contact is possible.`;
      } else {
        return `${item.name} does not use gluten ingredients, but our kitchen handles wheat and we cannot guarantee an entirely gluten free preparation.`;
      }
    }

    // vegan / vegetarian
    if (lower.includes('vegan')) {
      if (item.vegan) {
        return `${item.name} can be prepared as a vegan-friendly option. please confirm with the staff when ordering.`;
      }
      return `${item.name} is not fully vegan, but some ingredients may be adaptable. please check with the staff for details.`;
    }

    if (lower.includes('vegetarian')) {
      if (item.vegetarian) {
        return `${item.name} can be prepared as a vegetarian-friendly option. please confirm with the staff when ordering.`;
      }
      return `${item.name} is not a vegetarian dish.`;
    }

    // default: describe dish with ingredients and price
    return formatMenuItemSummary(item);
  }

  // generic dietary questions if not tied to a single dish
  if (lower.includes('dairy free') || lower.includes('dairy-free')) {
    return faq.dairy_info;
  }

  // no kb match
  return null;
}

// call local ollama mistral:instruct for general (non-restaurant) questions
async function callLLM(prompt) {
  const fullPrompt = `${systemPrompt.trim()}

user: ${prompt}
assistant:`;

  const start = Date.now();

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt: fullPrompt,
      stream: false,
      num_predict: 200
    })
  });

  const data = await response.json();
  const end = Date.now();

  console.log('====== llm log ======');
  console.log('model:', modelName);
  console.log('llm raw response:', data);
  console.log('llm response time:', end - start, 'ms');
  console.log('=====================');

  if (!data || !data.response) {
    return "sorry, i couldn't generate a response.";
  }

  return data.response.trim();
}

// main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({
        source: 'error',
        answer: 'please enter a message.'
      });
    }

    const normalized = normalizeMessage(message);

    console.log(`🔥 original: ${message}`);
    console.log(`✨ normalized: ${normalized}`);

    if (!req.session.history) {
      req.session.history = [];
    }

    // we only store user messages in history for now
    req.session.history.push({ role: 'user', content: normalized });

    if (req.session.history.length > 15) {
      req.session.history = req.session.history.slice(-15);
    }

    console.log('🧠 session memory:', req.session.history);

    // knowledge base lookup
    const kbStart = Date.now();
    const kbAnswer = getKbAnswer(normalized);
    const kbEnd = Date.now();

    console.log(`🔎 kb lookup time: ${kbEnd - kbStart} ms`);

    if (kbAnswer) {
      console.log('✅ kb hit for:', normalized);
      console.log('✅ kb answer:', kbAnswer);

      return res.json({
        source: 'kb',
        answer: kbAnswer
      });
    }

    // if this is still a restaurant-related question but we have no kb entry, do not let llm guess
    if (isRestaurantQuestion(normalized)) {
      console.log('🚫 restaurant question with no kb match, using safe fallback.');
      return res.json({
        source: 'kb-fallback',
        answer:
          "i'm not sure about that specific restaurant detail. please ask the staff or check the official menu for the most accurate information."
      });
    }

    // non-restaurant question → use llm freely
    const llmAnswer = await callLLM(normalized);

    return res.json({
      source: 'llm',
      answer: llmAnswer
    });
  } catch (err) {
    console.error('chat error:', err);
    return res.json({
      source: 'error',
      answer: 'error processing request.'
    });
  }
});

export default router;
