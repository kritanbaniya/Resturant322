/**
 * knowledge base service
 * handles kb lookups using semantic search
 */

import { getBestKbAnswer, searchKb } from './semanticSearch.js';

/**
 * find a menu item by name using semantic search
 * @param {string} text - text to search for menu item
 * @param {object} kb - knowledge base object
 * @returns {object|null} - menu item object or null
 */
export function findMenuItem(text, kb) {
  if (!text || !kb || !kb.menu) return null;
  
  const results = searchKb(text, kb, 0.1, 5);
  
  for (const result of results) {
    if (result.metadata.type === 'menu_item' && result.metadata.item) {
      return result.metadata.item;
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
  if (!item || !item.name) return '';
  
  let answer = item.name;
  
  if (item.description) {
    answer += `: ${item.description}`;
  }
  
  if (item.approx_price) {
    answer += ` Price: ${item.approx_price}`;
  }
  
  return answer;
}

/**
 * compute cheapest and most expensive dish from menu
 * @param {object} kb - knowledge base object
 * @returns {object|null} - { cheapest, priciest } or null
 */
export function getPriceExtremes(kb) {
  if (!kb || !kb.menu || !kb.menu.categories) return null;
  
  const allItems = [];
  
  // collect all menu items with prices
  Object.values(kb.menu.categories).forEach(category => {
    if (Array.isArray(category)) {
      category.forEach(item => {
        if (item && typeof item === 'object' && item.name && item.approx_price) {
          // extract numeric price from range like "$28–$32"
          const priceMatch = item.approx_price.match(/\$(\d+)/);
          if (priceMatch) {
            const price = parseInt(priceMatch[1], 10);
            allItems.push({ ...item, numericPrice: price });
          }
        }
      });
    }
  });
  
  if (allItems.length === 0) return null;
  
  const cheapest = allItems.reduce((min, item) => 
    item.numericPrice < min.numericPrice ? item : min
  );
  
  const priciest = allItems.reduce((max, item) => 
    item.numericPrice > max.numericPrice ? item : max
  );
  
  return { cheapest, priciest };
}

/**
 * main kb routing function - returns { answer, kbItem, score } or null
 * uses semantic search instead of hardcoded if/else chains
 * @param {string} message - user message to query
 * @param {object} kb - knowledge base object
 * @returns {object|null} - { answer: string, kbItem: string, score: number } or null if no match
 */
export function getKbAnswer(message, kb) {
  if (!message || !kb) return null;
  
  const lower = message.toLowerCase();
  
  // handle special cases that need custom logic
  
  // menu overview queries - handle before semantic search for better matching
  if (
    lower.includes('menu') && (
      lower.includes('what') || 
      lower.includes('whats') || 
      lower.includes('what\'s') ||
      lower.includes('show') ||
      lower.includes('list') ||
      lower.includes('have') ||
      lower.includes('serve') ||
      lower.includes('sell')
    )
  ) {
    if (kb.menu && kb.menu.categories) {
      const categories = Object.keys(kb.menu.categories);
      const categoryList = categories.join(', ');
      let answer = `We serve ${categoryList}.`;
      
      if (kb.menu.notes) {
        answer += ` ${kb.menu.notes}`;
      }
      
      if (kb.menu.signature_dishes && Array.isArray(kb.menu.signature_dishes)) {
        answer += ` Our signature dishes include ${kb.menu.signature_dishes.join(', ')}.`;
      }
      
      return {
        answer: answer.trim(),
        kbItem: 'menu',
        score: 1.0
      };
    }
  }
  
  // cheapest / most expensive dishes
  if (lower.includes('cheapest') || lower.includes('least expensive')) {
    const extremes = getPriceExtremes(kb);
    if (extremes) {
      return {
        answer: `The cheapest item is ${extremes.cheapest.name} at ${extremes.cheapest.approx_price}.`,
        kbItem: `menu.categories.${extremes.cheapest.category || 'unknown'}`,
        score: 1.0
      };
    }
  }
  
  if (lower.includes('expensive') || lower.includes('priciest') || lower.includes('most expensive')) {
    const extremes = getPriceExtremes(kb);
    if (extremes) {
      return {
        answer: `The most expensive item is ${extremes.priciest.name} at ${extremes.priciest.approx_price}.`,
        kbItem: `menu.categories.${extremes.priciest.category || 'unknown'}`,
        score: 1.0
      };
    }
  }
  
  // use semantic search for everything else
  const result = getBestKbAnswer(message, kb, 0.5);
  
  if (result) {
    return {
      answer: result.answer,
      kbItem: result.kbItem,
      score: result.score
    };
  }
  
  return null;
}