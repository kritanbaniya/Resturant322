/**
 * knowledge base service
 * handles kb lookups and menu item queries
 */

/**
 * find a menu item by name, alias, or internal key
 * @param {string} text - text to search for menu item
 * @param {object} menu_items - menu items object from kb
 * @returns {object|null} - menu item object or null
 */
export function findMenuItem(text, menu_items) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const items = menu_items || {};

  for (const key of Object.keys(items)) {
    const item = items[key];
    
    // Create a list of terms to search for:
    // 1. The official name (e.g. "fried rice")
    // 2. Any aliases (e.g. "friedrice")
    // 3. The system key (e.g. "fried_rice") - important for context injection from chat.js
    const candidates = [
      item.name,
      ...(item.aliases || []),
      key, 
      key.replace(/_/g, ' ') // also match key with spaces instead of underscores
    ].map((n) => n.toLowerCase());

    if (candidates.some((n) => lower.includes(n))) {
      return item;
    }
  }

  return null;
}

/**
 * format a detailed menu item summary
 * @param {object} item - menu item object
 * @returns {string} - formatted summary string
 */
export function formatMenuItemSummary(item) {
  let answer = `${item.name}: ${item.description}`;

  if (item.ingredients && item.ingredients.length > 0) {
    answer += ` ingredients include ${item.ingredients.join(', ')}.`;
  }

  if (typeof item.base_price === 'number') {
    answer += ` price: $${item.base_price}.`;
  }

  return answer;
}

/**
 * compute cheapest and most expensive dish
 * @param {object} menu_items - menu items object from kb
 * @returns {object|null} - { cheapest, priciest } or null
 */
export function getPriceExtremes(menu_items) {
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

/**
 * main kb routing function - returns { answer, kbItem } or null
 * @param {string} message - user message to query
 * @param {object} kb - knowledge base object with restaurant, menu_items, faq, price_info
 * @returns {object|null} - { answer: string, kbItem: string } or null if no match
 */
export function getKbAnswer(message, kb) {
  const { restaurant, menu_items, faq, price_info } = kb;
  const lower = message.toLowerCase();

  // ---------------------------------------------------------
  // 1. General Restaurant Info (Address, Hours, etc.)
  // ---------------------------------------------------------

  // Address / Location
  if (
    lower.includes('address') ||
    lower.includes('location') ||
    lower.includes('where are you') ||
    lower.includes('where is the restaurant') ||
    lower.includes('where is this restaurant') ||
    (lower.includes('where') && lower.includes('restaurant') && (lower.includes('located') || lower.includes('location'))) ||
    lower.includes('street') ||
    lower.includes('brooklyn')
  ) {
    return { answer: restaurant.address, kbItem: 'restaurant.address' };
  }

  if (lower.includes('zip') || lower.includes('postal code')) {
    return { answer: restaurant.zip, kbItem: 'restaurant.zip' };
  }

  // Hours
  if (
    lower.includes('hours') ||
    lower.includes('open') ||
    lower.includes('close') ||
    lower.includes('time')
  ) {
    // Distinguish between generic "open" and specific policy questions if needed,
    // but usually "when are you open" hits here.
    return { answer: restaurant.hours.summary, kbItem: 'restaurant.hours.summary' };
  }

  // Contact
  if (lower.includes('phone') || lower.includes('number') || lower.includes('email') || lower.includes('contact')) {
     // If contact info is placeholders in JSON, we should probably genericize or warn, 
     // but here we just return what's in the KB.
     return { answer: `You can reach us at ${restaurant.contact.phone} or ${restaurant.contact.email}.`, kbItem: 'restaurant.contact' };
  }

  // ---------------------------------------------------------
  // 2. High-Level Menu Questions
  // ---------------------------------------------------------

  // Menu Overview
  if (
    lower.includes('menu') ||
    lower.includes('what food') ||
    lower.includes('what do you sell') ||
    lower.includes('what dishes') ||
    lower.includes('what do you have')
  ) {
    return { answer: faq.menu_overview, kbItem: 'faq.menu_overview' };
  }

  // Popular / Recommend
  if (
    lower.includes('popular') ||
    lower.includes('recommend') ||
    lower.includes('best') ||
    lower.includes('favorite')
  ) {
    return { answer: faq.popular_items, kbItem: 'faq.popular_items' };
  }

  // Dietary Generic
  if (lower.includes('vegan') && !findMenuItem(lower, menu_items)) {
    return { answer: faq.vegan_options, kbItem: 'faq.vegan_options' };
  }
  if (lower.includes('vegetarian') && !findMenuItem(lower, menu_items)) {
    return { answer: faq.vegetarian_options, kbItem: 'faq.vegetarian_options' };
  }
  if (lower.includes('gluten') && !findMenuItem(lower, menu_items)) {
    return { answer: faq.gluten_info, kbItem: 'faq.gluten_info' };
  }
  if (lower.includes('dairy') && !findMenuItem(lower, menu_items)) {
    return { answer: faq.dairy_info, kbItem: 'faq.dairy_info' };
  }
  if (lower.includes('halal')) {
    return { answer: restaurant.dietary.halal_status, kbItem: 'restaurant.dietary.halal_status' };
  }
  if (lower.includes('nut') || lower.includes('allergy')) {
    return { answer: faq.nut_allergy_info, kbItem: 'faq.nut_allergy_info' };
  }

  // ---------------------------------------------------------
  // 3. Policies & Services
  // ---------------------------------------------------------

  if (lower.includes('reservation') || lower.includes('book')) {
    return { answer: restaurant.policies.reservations, kbItem: 'restaurant.policies.reservations' };
  }
  if (lower.includes('refund') || lower.includes('return')) {
    return { answer: restaurant.policies.refunds, kbItem: 'restaurant.policies.refunds' };
  }
  if (lower.includes('delivery') || lower.includes('order online') || lower.includes('takeout') || lower.includes('pickup')) {
    return { answer: restaurant.policies.delivery, kbItem: 'restaurant.policies.delivery' };
  }
  if (lower.includes('catering')) {
    return { answer: restaurant.policies.catering, kbItem: 'restaurant.policies.catering' };
  }

  // ---------------------------------------------------------
  // 4. Restaurant Facts (Chefs, Owner, History)
  // ---------------------------------------------------------

  if (lower.includes('chef') || lower.includes('cook')) {
    return { answer: restaurant.chefs_summary, kbItem: 'restaurant.chefs_summary' };
  }
  if (lower.includes('owner') || lower.includes('who owns')) {
    return { answer: restaurant.owner_info, kbItem: 'restaurant.owner_info' };
  }
  if (lower.includes('founded') || lower.includes('history') || lower.includes('how long')) {
    return { answer: `The Himalayan House opened in ${restaurant.founded_year}.`, kbItem: 'restaurant.founded_year' };
  }
  if (lower.includes('fun fact')) {
    return { answer: restaurant.fun_fact, kbItem: 'restaurant.fun_fact' };
  }

  // ---------------------------------------------------------
  // 5. Price Extremes (Cheapest / Most Expensive)
  // ---------------------------------------------------------

  if (lower.includes('cheapest')) {
    const extremes = getPriceExtremes(menu_items);
    if (!extremes) return null;
    const { cheapest } = extremes;
    // Find key to return precise kbItem
    const itemKey = Object.keys(menu_items).find(k => menu_items[k] === cheapest);
    
    return { 
      answer: `Among our main dishes, the cheapest is ${cheapest.name} at $${cheapest.base_price}.`, 
      kbItem: `menu_items.${itemKey}.base_price` 
    };
  }

  if (lower.includes('expensive') || lower.includes('priciest')) {
    const extremes = getPriceExtremes(menu_items);
    if (!extremes) return null;
    const { priciest } = extremes;
    const itemKey = Object.keys(menu_items).find(k => menu_items[k] === priciest);
    
    return { 
      answer: `Among our main dishes, the most expensive is ${priciest.name} at $${priciest.base_price}.`, 
      kbItem: `menu_items.${itemKey}.base_price` 
    };
  }

  // ---------------------------------------------------------
  // 6. Specific Dish Logic (Price, Ingredients, Description)
  // ---------------------------------------------------------

  // Attempt to find a specific dish mentioned in the text
  const item = findMenuItem(lower, menu_items);
  const itemKey = item ? Object.keys(menu_items).find(k => menu_items[k] === item) : null;

  if (item) {
    // Price
    if (lower.includes('how much') || lower.includes('price') || lower.includes('cost')) {
      if (typeof item.base_price === 'number') {
        return { answer: `${item.name}: $${item.base_price}.`, kbItem: `menu_items.${itemKey}.base_price` };
      }
    }

    // Spicy / Heat
    if (lower.includes('spicy') || lower.includes('spice') || lower.includes('hot')) {
      let ans = `${item.name} has a ${item.spice_level} spice level.`;
      if (item.spice_level === 'mild') ans += " We can usually adjust it on request.";
      if (item.spice_level === 'hot') ans += " It is one of our spicier dishes.";
      return { answer: ans, kbItem: `menu_items.${itemKey}.spice_level` };
    }

    // Ingredients / Content
    if (lower.includes('ingredient') || lower.includes('contain') || lower.includes('made of')) {
      return { 
        answer: `${item.name} ingredients include: ${item.ingredients.join(', ')}.`, 
        kbItem: `menu_items.${itemKey}.ingredients` 
      };
    }

    // Dietary Specifics for this item
    if (lower.includes('gluten')) {
      const status = item.contains_gluten ? "contains gluten" : "does not use gluten ingredients (cross-contact possible)";
      return { answer: `${item.name} ${status}.`, kbItem: `menu_items.${itemKey}.contains_gluten` };
    }
    if (lower.includes('vegan')) {
      const status = item.vegan ? "is vegan" : "is not vegan";
      return { answer: `${item.name} ${status}.`, kbItem: `menu_items.${itemKey}.vegan` };
    }
    if (lower.includes('vegetarian')) {
      const status = item.vegetarian ? "is vegetarian" : "is not vegetarian";
      return { answer: `${item.name} ${status}.`, kbItem: `menu_items.${itemKey}.vegetarian` };
    }

    // Default: Description
    return { answer: formatMenuItemSummary(item), kbItem: `menu_items.${itemKey}` };
  }

  // ---------------------------------------------------------
  // 7. General Price / Drinks (Fallback if no dish match)
  // ---------------------------------------------------------
  
  if (lower.includes('drink') && (lower.includes('price') || lower.includes('cost') || lower.includes('how much'))) {
     return { answer: price_info.drinks_price_range, kbItem: 'price_info.drinks_price_range' };
  }

  return null;
}