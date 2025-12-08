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

  // exclude general knowledge questions and personal questions that should go to LLM
  // these patterns take precedence - if matched, it's NOT a restaurant question
  const generalKnowledgePatterns = [
    /^tell me a story$/i,
    /^tell me a (story|joke|tale)/i,
    /tell me (a|the) (story|joke|tale)/i,
    /^recommend a (movie|film|book|show|tv show)/i,
    /recommend (a|me) (movie|film|book|show)/i,
    /^explain (the|a) /i,
    /explain (the|a) (moon|python|programming|science|history|computer)/i,
    /^what is (python|programming|science|history|chemistry|physics)/i,
    /^how does (the|a) (moon|earth|computer|internet|phone)/i,
    /^what (is|are) (python|programming|science|history|chemistry|physics)/i
  ];

  // exclude personal/identity questions
  const personalQuestionPatterns = [
    /^what'?s? my name$/i,
    /^what is my name$/i,
    /^who am i$/i,
    /^what am i$/i
  ];

  // if it matches a general knowledge or personal pattern, it's NOT a restaurant question
  if (generalKnowledgePatterns.some((pattern) => pattern.test(text)) ||
      personalQuestionPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  const restaurantKeywords = [
    // basic restaurant terms
    'restaurant',
    'resturant',
    'restraunt',
    'menu',
    'dish',
    'dishes',
    'food',
    'serve',
    'serv',
    'sell',
    'sel',
    'cook',
    'cooking',
    'kitchen',
    
    // menu items
    'momo',
    'momoz',
    'mommos',
    'chow mein',
    'chowmein',
    'fried rice',
    'friedrice',
    'dal bhat',
    'dalbhat',
    'dhal bhat',
    'himalayan curry',
    'curry',
    'thukpa',
    'samosa',
    'samosas',
    'masala fries',
    'fries',
    
    // pricing
    'price',
    'prices',
    'cost',
    'costs',
    'how much',
    'cheap',
    'cheapest',
    'expensive',
    'priciest',
    'discount',
    'discounts',
    'fee',
    'fees',
    
    // hours and operations
    'hours',
    'hour',
    'open',
    'opening',
    'close',
    'closing',
    'breakfast',
    'lunch',
    'dinner',
    
    // location
    'address',
    'adrres',
    'adres',
    'where are you',
    'where is this',
    'where is the',
    'where is',
    'location',
    'locate',
    'zip',
    'zipcode',
    'postal code',
    'street',
    'city',
    'borough',
    'brooklyn',
    'queens',
    'manhattan',
    
    // dietary and ingredients
    'halal',
    'vegan',
    'vegetarian',
    'gluten',
    'dairy',
    'nut',
    'nuts',
    'allergy',
    'allergies',
    'allergen',
    'ingredient',
    'ingredients',
    'spice',
    'spices',
    'recipe',
    'recipes',
    'sauce',
    'sauces',
    'secret',
    'msg',
    'monosodium',
    'monosodium glutamate',
    'glutamate',
    'oil',
    'oils',
    'fry',
    'fried',
    'supplier',
    'suppliers',
    'source',
    'sourcing',
    'certification',
    'certified',
    'nutrition',
    'nutritional',
    'calorie',
    'calories',
    'protein',
    'carbs',
    'carbohydrates',
    
    // staff and ownership
    'chef',
    'chefs',
    'cook',
    'cooks',
    'owner',
    'owners',
    'ownership',
    'staff',
    'employee',
    'employees',
    'team',
    'workers',
    'payroll',
    'budget',
    
    // policies and services
    'reservation',
    'reservations',
    'book',
    'booking',
    'catering',
    'cater',
    'delivery',
    'deliver',
    'pickup',
    'pick up',
    'takeout',
    'take out',
    'order online',
    'online order',
    'refund',
    'refunds',
    'return',
    'returns',
    'policy',
    'policies',
    'cancellation',
    'cancel',
    
    // restaurant details
    'tables',
    'table',
    'seating',
    'seats',
    'capacity',
    'size',
    'big',
    'large',
    'small',
    'founded',
    'opened',
    'established',
    'history',
    'story',
    'best',
    'recommend',
    'recommendation',
    'popular',
    'favorite',
    'favourite'
  ];

  // direct keyword match
  if (restaurantKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  // context-aware: check for possessive pronouns + restaurant context
  const possessivePatterns = [
    // "your [restaurant term]" or "you [restaurant term]"
    /\b(your|you|ur)\s+(food|menu|dish|dishes|restaurant|kitchen|chef|chefs|owner|staff|ingredient|ingredients|spice|spices|recipe|recipes|sauce|sauces|oil|oils|supplier|suppliers|secret|best|recommendation|recommend|popular|favorite|favourite)\b/i,
    // "you use/cook/make [restaurant term]" or "[restaurant term] you use"
    /\b(your|you|ur)\s+(use|uses|using|fry|fries|fried|cook|cooks|cooking|make|makes|making|sell|sells|selling|serve|serves|serving|have|has|had)\b/i,
    // "what [restaurant term] do you use" - catches "what spices do you use"
    /\b(what|which)\s+(spice|spices|ingredient|ingredients|oil|oils|recipe|recipes|sauce|sauces|supplier|suppliers|secret|msg|monosodium)\s+(do|does|did)\s+(you|your|ur|they|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|have|has|had)\b/i,
    // "what do you use [restaurant term]" - catches "what do you use for cooking"
    /\b(what|which)\s+(do|does|did)\s+(you|your|ur|they|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|fry|fries|fried)\s+(for|in|with|to)\s+(food|dish|dishes|cooking|frying|making)\b/i,
    // general "what/which/how/who/when/where do you [action]" with restaurant context
    /\b(what|which|how|who|when|where)\s+(do|does|did|is|are|was|were)\s+(you|your|ur|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|sell|sells|selling|serve|serves|serving|have|has|had)\b/i
  ];

  if (possessivePatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return false;
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

// main kb routing function - returns { answer, kbItem } or null
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
    return { answer: restaurant.address, kbItem: 'restaurant.address' };
  }

  if (lower.includes('zip') || lower.includes('zipcode') || lower.includes('postal code')) {
    return { answer: restaurant.zip, kbItem: 'restaurant.zip' };
  }

  if (lower.includes('brooklyn')) {
    return { answer: `${restaurant.address}`, kbItem: 'restaurant.address' };
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
    return { answer: restaurant.hours.summary, kbItem: 'restaurant.hours.summary' };
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
    return { answer: faq.menu_overview, kbItem: 'faq.menu_overview' };
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
    return { answer: faq.popular_items, kbItem: 'faq.popular_items' };
  }

  // desserts
  if (lower.includes('dessert') || lower.includes('desert')) {
    return { answer: faq.desserts, kbItem: 'faq.desserts' };
  }

  // fun fact
  if (lower.includes('fun fact')) {
    return { answer: restaurant.fun_fact, kbItem: 'restaurant.fun_fact' };
  }

  // halal / vegan / gluten / dairy / nuts
  if (lower.includes('halal')) {
    return { answer: restaurant.dietary.halal_status, kbItem: 'restaurant.dietary.halal_status' };
  }

  if (lower.includes('vegan')) {
    return { answer: faq.vegan_options, kbItem: 'faq.vegan_options' };
  }

  if (lower.includes('vegetarian')) {
    return { answer: faq.vegetarian_options, kbItem: 'faq.vegetarian_options' };
  }

  if (lower.includes('gluten')) {
    return { answer: faq.gluten_info, kbItem: 'faq.gluten_info' };
  }

  if (lower.includes('dairy')) {
    return { answer: faq.dairy_info, kbItem: 'faq.dairy_info' };
  }

  if (lower.includes('nut') || lower.includes('allergy')) {
    return { answer: faq.nut_allergy_info, kbItem: 'faq.nut_allergy_info' };
  }

  // reservations / refund / delivery / catering / cancellation
  if (
    lower.includes('reservation') ||
    lower.includes('reservations') ||
    lower.includes('book a table')
  ) {
    return { answer: restaurant.policies.reservations, kbItem: 'restaurant.policies.reservations' };
  }

  if (
    lower.includes('refund policy') ||
    lower.includes('refund') ||
    lower.includes('return policy')
  ) {
    return { answer: restaurant.policies.refunds, kbItem: 'restaurant.policies.refunds' };
  }

  if (
    lower.includes('deliver') ||
    lower.includes('delivery') ||
    lower.includes('do you deliver') ||
    lower.includes('can i order online') ||
    lower.includes('order online')
  ) {
    return { answer: restaurant.policies.delivery, kbItem: 'restaurant.policies.delivery' };
  }

  if (
    lower.includes('catering') ||
    lower.includes('cater')
  ) {
    return { answer: restaurant.policies.catering, kbItem: 'restaurant.policies.catering' };
  }

  if (
    lower.includes('cancellation fee') ||
    lower.includes('cancel reservation') ||
    lower.includes('cancellation policy')
  ) {
    return { answer: restaurant.policies.cancellation, kbItem: 'restaurant.policies.cancellation' };
  }

  // staff / chefs / owner / seating / founded
  if (
    lower.includes('who cooks') ||
    lower.includes('who makes the food') ||
    lower.includes('chef') ||
    lower.includes('chefs')
  ) {
    return { answer: restaurant.chefs_summary, kbItem: 'restaurant.chefs_summary' };
  }

  if (
    lower.includes('how many tables') ||
    lower.includes('how big is your restaurant') ||
    lower.includes('how many seats') ||
    lower.includes('seating')
  ) {
    return { answer: restaurant.seating_summary, kbItem: 'restaurant.seating_summary' };
  }

  if (
    lower.includes('when were you founded') ||
    lower.includes('when was the restaurant founded') ||
    lower.includes('when did you open') ||
    lower.includes('how long have you been open')
  ) {
    return { answer: `the himalayan house opened in ${restaurant.founded_year}.`, kbItem: 'restaurant.founded_year' };
  }

  if (lower.includes('who owns') || lower.includes('owner')) {
    return { answer: restaurant.owner_info, kbItem: 'restaurant.owner_info' };
  }

  // prices and drinks
  if (
    lower.includes('how much are the drinks') ||
    lower.includes('drink prices') ||
    (lower.includes('drinks') && lower.includes('price'))
  ) {
    return { answer: price_info.drinks_price_range, kbItem: 'price_info.drinks_price_range' };
  }

  if (lower.includes('cheapest')) {
    // if asking "why" it's cheapest, provide a brief explanation along with the fact
    if (lower.includes('why')) {
      const extremes = getPriceExtremes();
      if (!extremes) return null;
      const { cheapest } = extremes;
      const itemKey = Object.keys(menu_items).find(k => menu_items[k].name === cheapest.name);
      return { 
        answer: `among our main dishes, the cheapest is ${cheapest.name} at $${cheapest.base_price}. it's priced lower because it's a simpler snack item compared to our main entrees.`, 
        kbItem: `menu_items.${itemKey}.base_price` 
      };
    }
    
    const extremes = getPriceExtremes();
    if (!extremes) return null;

    const { cheapest } = extremes;
    const itemKey = Object.keys(menu_items).find(k => menu_items[k].name === cheapest.name);
    return { answer: `among our main dishes, the cheapest is ${cheapest.name} at $${cheapest.base_price}.`, kbItem: `menu_items.${itemKey}.base_price` };
  }

  if (lower.includes('most expensive')) {
    const extremes = getPriceExtremes();
    if (!extremes) return null;

    const { priciest } = extremes;
    const itemKey = Object.keys(menu_items).find(k => menu_items[k].name === priciest.name);
    return { answer: `among our main dishes, the most expensive is ${priciest.name} at $${priciest.base_price}.`, kbItem: `menu_items.${itemKey}.base_price` };
  }

  // per-dish logic: price / spicy / gluten / vegan / description
  const item = findMenuItem(lower);
  const itemKey = item ? Object.keys(menu_items).find(k => menu_items[k] === item) : null;

  if (item) {
    // price for this dish
    if (
      lower.includes('how much') ||
      lower.includes('price') ||
      lower.includes('cost')
    ) {
      if (typeof item.base_price === 'number') {
        return { answer: `${item.name}: $${item.base_price}.`, kbItem: `menu_items.${itemKey}.base_price` };
      }
    }

    // spicy / spice level
    if (lower.includes('spicy') || lower.includes('spice')) {
      if (item.spice_level === 'mild') {
        return { answer: `${item.name} is mildly spiced, but we can usually adjust the heat level on request.`, kbItem: `menu_items.${itemKey}.spice_level` };
      } else if (item.spice_level === 'medium') {
        return { answer: `${item.name} has a medium level of heat. please let us know if you prefer it milder.`, kbItem: `menu_items.${itemKey}.spice_level` };
      } else if (item.spice_level === 'hot') {
        return { answer: `${item.name} is one of our spicier dishes.`, kbItem: `menu_items.${itemKey}.spice_level` };
      }
    }

    // gluten
    if (lower.includes('gluten')) {
      if (item.contains_gluten) {
        return { answer: `${item.name} is not gluten free because it contains wheat-based ingredients. our kitchen also handles wheat, so cross contact is possible.`, kbItem: `menu_items.${itemKey}.contains_gluten` };
      } else {
        return { answer: `${item.name} does not use gluten ingredients, but our kitchen handles wheat and we cannot guarantee an entirely gluten free preparation.`, kbItem: `menu_items.${itemKey}.contains_gluten` };
      }
    }

    // vegan / vegetarian
    if (lower.includes('vegan')) {
      if (item.vegan) {
        return { answer: `${item.name} can be prepared as a vegan-friendly option. please confirm with the staff when ordering.`, kbItem: `menu_items.${itemKey}.vegan` };
      }
      return { answer: `${item.name} is not fully vegan, but some ingredients may be adaptable. please check with the staff for details.`, kbItem: `menu_items.${itemKey}.vegan` };
    }

    if (lower.includes('vegetarian')) {
      if (item.vegetarian) {
        return { answer: `${item.name} can be prepared as a vegetarian-friendly option. please confirm with the staff when ordering.`, kbItem: `menu_items.${itemKey}.vegetarian` };
      }
      return { answer: `${item.name} is not a vegetarian dish.`, kbItem: `menu_items.${itemKey}.vegetarian` };
    }

    // default: describe dish with ingredients and price
    return { answer: formatMenuItemSummary(item), kbItem: `menu_items.${itemKey}` };
  }

  // generic dietary questions if not tied to a single dish
  if (lower.includes('dairy free') || lower.includes('dairy-free')) {
    return { answer: faq.dairy_info, kbItem: 'faq.dairy_info' };
  }

  // no kb match
  return null;
}

// helper: remove all emojis and Unicode symbols from text
function removeEmojis(text) {
  if (!text) return text;
  
  // Remove emojis using regex pattern that matches most Unicode emoji ranges
  // This covers: Emoticons, Miscellaneous Symbols, Dingbats, Supplemental Symbols, etc.
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation Selectors
    .replace(/[\u{200D}]/gu, '') // Zero Width Joiner
    .replace(/[\u{200B}-\u{200D}]/gu, '') // Zero Width spaces
    .replace(/[\u{FEFF}]/gu, '') // Zero Width No-Break Space
    .replace(/[\u{2060}]/gu, '') // Word Joiner
    .trim();
}

// call local ollama mistral:instruct for general (non-restaurant) questions
// returns { answer, responseTime }
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
  const responseTime = end - start;

  console.log('====== llm log ======');
  console.log('model:', modelName);
  console.log('llm raw response:', data);
  console.log('llm response time:', responseTime, 'ms');
  console.log('=====================');

  if (!data || !data.response) {
    return { answer: "sorry, i couldn't generate a response.", responseTime };
  }

  // Remove emojis from response as a safety measure
  const cleanedAnswer = removeEmojis(data.response.trim());
  
  // Log if emojis were removed
  if (cleanedAnswer !== data.response.trim()) {
    console.log('⚠️  Emojis were removed from LLM response');
  }

  return { answer: cleanedAnswer, responseTime };
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

    // STEP 1: Normalize message FIRST (before KB lookup or LLM)
    // This ensures typos like "wut food u hav" are fixed to "what food do you have"
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

    // track total response time
    const totalStart = Date.now();

    // knowledge base lookup
    const kbStart = Date.now();
    const kbResult = getKbAnswer(normalized);
    const kbEnd = Date.now();
    const kbLookupTime = kbEnd - kbStart;

    console.log(`🔎 kb lookup time: ${kbLookupTime} ms`);

    if (kbResult) {
      console.log('✅ kb hit for:', normalized);
      console.log('✅ kb answer:', kbResult.answer);
      console.log('✅ kb item:', kbResult.kbItem);

      const totalTime = Date.now() - totalStart;

      return res.json({
        source: 'kb',
        answer: kbResult.answer,
        kbHit: true,
        kbItem: kbResult.kbItem,
        responseTime: totalTime
      });
    }

    // if this is still a restaurant-related question but we have no kb entry, do not let llm guess
    if (isRestaurantQuestion(normalized)) {
      console.log('🚫 restaurant question with no kb match, using safe fallback.');
      const totalTime = Date.now() - totalStart;

      return res.json({
        source: 'kb-fallback',
        answer:
          "i'm not sure about that specific restaurant detail. please check the official menu or ask the staff directly.",
        kbHit: false,
        responseTime: totalTime
      });
    }

    // non-restaurant question → use llm freely
    const llmResult = await callLLM(normalized);
    const totalTime = Date.now() - totalStart;

    return res.json({
      source: 'llm',
      answer: llmResult.answer,
      kbHit: false,
      responseTime: totalTime,
      llmResponseTime: llmResult.responseTime
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
